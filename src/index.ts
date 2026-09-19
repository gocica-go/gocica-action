import core from "@actions/core";

import { install } from "./install";
import { clearDefaultCache } from "./clear-default-cache";
import { startModuleProxy } from "./module-proxy";

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
  const dir = core.getInput("dir");
  const logLevel = core.getInput("log-level") || "info";
  const moduleProxy = core.getBooleanInput("module-proxy");

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
      // The daemon needs a directory of its own; gocica puts the module store
      // under <dir>/mod.
      await startModuleProxy(binPath, dir || defaultDir(), logLevel);
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
