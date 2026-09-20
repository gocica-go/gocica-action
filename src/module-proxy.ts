import * as core from "@actions/core";
import { spawn } from "child_process";
import { openSync, readFileSync } from "fs";
import { mkdir } from "fs/promises";
import os from "os";
import path from "path";

export const STATE_BINARY = "gocica-binary";
export const STATE_STATE_FILE = "gocica-state-file";

// gocica's own name for the flag, so `proxy-stop` and the ready action find the
// daemon through the environment without any state of their own.
export const ENV_STATE_FILE = "GOCICA_MODULE_PROXY_STATE_FILE";

// Generous: it covers restoring the module cache, not just opening a socket.
const HEALTH_TIMEOUT_MS = 300_000;
const POLL_INTERVAL_MS = 100;

/**
 * How far the step waits before it returns.
 *
 * "ready" is the safe default: every cache is restored and the next step can
 * run the go command. "listening" returns as soon as GOPROXY is known, so the
 * warm-up overlaps whatever comes next (actions/setup-go, typically); the
 * `ready` action then has to run before the first go command.
 */
export type WaitFor = "ready" | "listening";

export function parseWaitFor(input: string): WaitFor {
  switch (input) {
    case "":
    case "ready":
      return "ready";
    case "listening":
      return "listening";
    default:
      throw new Error(
        `wait-for must be "ready" or "listening", got ${JSON.stringify(input)}`,
      );
  }
}

export interface ProxyState {
  pid: number;
  url: string;
}

interface Health {
  ok: boolean;
  ready: boolean;
}

export interface ModuleProxyOptions {
  // Module cache to restore extracted modules into. Empty leaves it to gocica,
  // which asks the go command and falls back to the toolchain's default rule.
  goModCache: string;
  waitFor: WaitFor;
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
  options: ModuleProxyOptions,
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

  if (options.goModCache) {
    args.push("--go-mod-cache", options.goModCache);
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

  const state = await waitForProxy(stateFile, () => exited, options.waitFor);
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
  core.exportVariable(ENV_STATE_FILE, stateFile);
  core.saveState(STATE_STATE_FILE, stateFile);
  core.saveState(STATE_BINARY, binPath);

  core.info(
    `GoCICa module proxy ${options.waitFor} on ${state.url}` +
      (options.waitFor === "listening"
        ? ". Run gocica-go/gocica-action/ready before the first go command."
        : ""),
  );
}

/**
 * Poll the daemon until it is listening or ready, or until it is gone.
 *
 * Readiness, not liveness, is what the go command needs: the daemon restores
 * modules into GOMODCACHE in extracted form, and the go command must not start
 * extracting into the same directories while it does.
 */
export async function waitForProxy(
  stateFile: string,
  exited: () => boolean,
  target: WaitFor,
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
          if (target === "listening") {
            return state;
          }
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

export function readState(stateFile: string): ProxyState | null {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8")) as ProxyState;
  } catch {
    return null;
  }
}

/** Whether the daemon recorded in the state file is still running. */
export function isAlive(state: ProxyState): boolean {
  try {
    process.kill(state.pid, 0);

    return true;
  } catch {
    return false;
  }
}
