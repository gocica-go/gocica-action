import * as core from "@actions/core";
import { spawn } from "child_process";
import { openSync, readFileSync } from "fs";
import { mkdir } from "fs/promises";
import os from "os";
import path from "path";

export const STATE_BINARY = "gocica-binary";
export const STATE_STATE_FILE = "gocica-state-file";

// Generous: it covers restoring the module cache, not just opening a socket.
const HEALTH_TIMEOUT_MS = 300_000;
const POLL_INTERVAL_MS = 100;

interface ProxyState {
  pid: number;
  url: string;
}

interface Health {
  ok: boolean;
  ready: boolean;
}

/**
 * Start the GOPROXY daemon and point GOPROXY at it.
 *
 * The daemon is spawned detached rather than daemonising itself, so the same Go
 * binary works on Windows and macOS without any fork/setsid handling.
 *
 * Nothing here is allowed to fail the job: if the daemon does not come up,
 * GOPROXY is left alone and the build runs exactly as it would without gocica.
 */
export async function startModuleProxy(
  binPath: string,
  dir: string,
  logLevel: string,
): Promise<void> {
  const runnerTemp = process.env.RUNNER_TEMP || os.tmpdir();
  const stateFile = path.join(runnerTemp, "gocica-proxy.json");
  const logFile = path.join(runnerTemp, "gocica-proxy.log");

  await mkdir(dir, { recursive: true });

  const args = [
    "serve",
    "--dir",
    dir,
    "--log-level",
    logLevel,
    "--state-file",
    stateFile,
  ];

  const upstream = core.getInput("upstream-proxy");
  if (upstream) {
    args.push("--upstream", upstream);
  }

  const log = openSync(logFile, "a");
  const child = spawn(binPath, args, {
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();

  // A gocica too old to know the `serve` subcommand exits straight away. Without
  // this the action would sit out the whole health timeout for nothing.
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  child.once("error", () => {
    exited = true;
  });

  const state = await waitForProxy(stateFile, () => exited);
  if (!state) {
    core.warning(
      `GoCICa module proxy did not come up; see ${logFile}. Continuing without it.`,
    );

    return;
  }

  // Prepend, never replace: the previous value stays as the fallback. The "|"
  // separator makes the go command fall back on *any* error, not just 404/410,
  // so a daemon that dies mid-build cannot break it.
  const previous = process.env.GOPROXY || "https://proxy.golang.org,direct";
  core.exportVariable("GOPROXY", `${state.url}|${previous}`);
  core.saveState(STATE_STATE_FILE, stateFile);
  core.saveState(STATE_BINARY, binPath);

  core.info(`GoCICa module proxy listening on ${state.url}`);
}

async function waitForProxy(
  stateFile: string,
  exited: () => boolean,
): Promise<ProxyState | null> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (exited()) {
      return null;
    }

    const state = readState(stateFile);
    if (state) {
      try {
        const res = await fetch(`${state.url}/-/healthz`);
        if (res.ok) {
          // Readiness, not liveness: the daemon restores modules into GOMODCACHE
          // in extracted form, and the go command must not start extracting into
          // the same directories while it does.
          const health = (await res.json()) as Health;
          if (health.ready) {
            return state;
          }
        }
      } catch {
        // Not listening yet.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return null;
}

function readState(stateFile: string): ProxyState | null {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8")) as ProxyState;
  } catch {
    return null;
  }
}
