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

    let result;
    try {
      result = await getExecOutput(cmd);
    } catch (error) {
      // No go command yet: the action is running before actions/setup-go, which
      // is the point of `wait-for: listening`. There is nothing to clean then.
      const err = error as Error;
      core.info(`Skipping ${cmd}: ${err.message}`);

      return;
    }

    const { stderr, exitCode } = result;
    if (exitCode !== 0) {
      core.error(`Failed to run ${cmd} (code: ${exitCode}): ${stderr}`);
    }
  }
};
