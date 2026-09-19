import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";

export const clearDefaultCache = async () => {
  const commands = ["go clean -cache"];

  // Only for benchmarking a cold module cache. Off by default: it would throw
  // away a module cache another action deliberately restored.
  if (core.getBooleanInput("clean-module-cache")) {
    commands.push("go clean -modcache");
  }

  for (const cmd of commands) {
    core.info(`Running ${cmd}...`);

    const { stderr, exitCode } = await getExecOutput(cmd);

    if (exitCode !== 0) {
      core.error(`Failed to run ${cmd} (code: ${exitCode}): ${stderr}`);
    }
  }
};
