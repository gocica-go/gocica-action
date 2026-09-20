import core from "@actions/core";
import path from "path";

import { install } from "./install";
import { clearDefaultCache } from "./clear-default-cache";
import { startModuleProxy, parseWaitFor } from "./module-proxy";
import { mountTmpfs } from "./tmpfs";

function buildFlags(dir: string): string[] {
  const flags: string[] = [];

  // Basic settings
  if (dir) {
    flags.push("--dir", dir);
  }

  const logLevel = core.getInput("log-level");
  if (logLevel) {
    flags.push("--log-level", logLevel);
  }

  return flags;
}

try {
  const logLevel = core.getInput("log-level") || "info";
  const moduleProxy = core.getBooleanInput("module-proxy");
  const waitFor = parseWaitFor(core.getInput("wait-for"));

  // The mount comes first: where the caches live decides everything below.
  const mount = await mountTmpfs();

  // Resolve the directory once, so the cacheprog and the module proxy always
  // agree on where the cache lives.
  const dirInput = core.getInput("dir");
  const dir = dirInput || (mount ? path.join(mount, "gocica") : defaultDir());
  if (mount && dirInput) {
    core.info(`dir is set, so the store stays at ${dir} rather than on tmpfs.`);
  }

  // GOMODCACHE moves onto the tmpfs with the store, unless the workflow put it
  // somewhere on purpose. Exported before the daemon starts: a detached child
  // copies the environment at spawn time, and later steps read it from here.
  let goModCache = process.env.GOMODCACHE || "";
  if (mount) {
    if (goModCache) {
      core.info(
        `GOMODCACHE is already ${goModCache}; it stays there rather than on tmpfs.`,
      );
    } else {
      goModCache = path.join(mount, "go", "pkg", "mod");
      core.exportVariable("GOMODCACHE", goModCache);
    }
  }

  const installPromise = (async () => {
    const binPath = await install();
    const flags = buildFlags(dir);
    const command =
      flags.length > 0 ? `${binPath} ${flags.join(" ")}` : binPath;

    core.exportVariable("GOCACHEPROG", command);
    core.exportVariable(
      "ACTIONS_RUNTIME_TOKEN",
      process.env.ACTIONS_RUNTIME_TOKEN,
    );
    core.exportVariable("ACTIONS_RESULTS_URL", process.env.ACTIONS_RESULTS_URL);

    if (moduleProxy) {
      // gocica puts the module store under <dir>/mod.
      await startModuleProxy(binPath, dir, logLevel, { goModCache, waitFor });
    }
  })();

  const clearCachePromise = clearDefaultCache();

  await Promise.all([installPromise, clearCachePromise]);
} catch (error) {
  const err = error as Error;
  core.error(`Failed to run: ${error}, ${err.stack}`);
  core.setFailed(err.message);
}

function defaultDir(): string {
  // Mirrors os.UserCacheDir()/gocica, which is what gocica itself falls back to.
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const base =
    process.env.XDG_CACHE_HOME ||
    (process.platform === "darwin"
      ? `${home}/Library/Caches`
      : process.platform === "win32"
        ? process.env.LOCALAPPDATA || `${home}/AppData/Local`
        : `${home}/.cache`);

  return `${base}/gocica`;
}
