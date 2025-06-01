import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";

const cacheClearCmd = "go clean -cache";

export const clearDefaultCache = async () => {
  core.info(`Clearing default cache...`);

  const { stderr, exitCode } = await getExecOutput(cacheClearCmd);

  if (exitCode !== 0) {
    core.error(`Failed to clear default cache(code: ${exitCode}): ${stderr}`);
  }
};
