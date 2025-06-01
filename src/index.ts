import core from "@actions/core";

import { install } from "./install";
import { clearDefaultCache } from "./clear-default-cache";

function buildFlags(): string[] {
  const flags: string[] = [];

  // Basic settings
  const dir = core.getInput("dir");
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
  const installPromise = (async () => {
    const binPath = await install();
    const flags = buildFlags();
    const command =
      flags.length > 0 ? `${binPath} ${flags.join(" ")}` : binPath;

    core.exportVariable("GOCACHEPROG", command);
    core.exportVariable(
      "ACTIONS_RUNTIME_TOKEN",
      process.env.ACTIONS_RUNTIME_TOKEN,
    );
    core.exportVariable("ACTIONS_RESULTS_URL", process.env.ACTIONS_RESULTS_URL);
  })();

  const clearCachePromise = clearDefaultCache();

  await Promise.all([installPromise, clearCachePromise]);
} catch (error) {
  const err = error as Error;
  core.error(`Failed to run: ${error}, ${err.stack}`);
  core.setFailed(err.message);
}
