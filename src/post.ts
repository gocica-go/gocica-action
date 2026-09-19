import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";

import { STATE_BINARY, STATE_STATE_FILE } from "./module-proxy";

// Flush the module cache to the remote and stop the daemon.
//
// A post step must never fail the job: by the time it runs, the build has
// already succeeded or failed on its own merits, and losing a cache upload is
// not worth turning a green run red.
try {
  const binPath = core.getState(STATE_BINARY);
  const stateFile = core.getState(STATE_STATE_FILE);

  if (!binPath || !stateFile) {
    core.info("GoCICa module proxy was not started. Nothing to flush.");
  } else {
    const { exitCode, stderr } = await getExecOutput(
      binPath,
      ["proxy-stop", "--state-file", stateFile],
      { ignoreReturnCode: true },
    );
    if (exitCode !== 0) {
      core.warning(`Failed to stop the GoCICa module proxy: ${stderr}`);
    }
  }
} catch (error) {
  const err = error as Error;
  core.warning(`Failed to run the GoCICa post step: ${err.message}`);
}
