import * as core from "@actions/core";

import {
  ENV_STATE_FILE,
  isAlive,
  readState,
  waitForProxy,
} from "./module-proxy";

// Wait for a daemon started with `wait-for: listening` to finish restoring the
// caches. It is the second half of that step, run after whatever the warm-up
// was meant to overlap.
//
// Like the start, it never fails the job: GOPROXY carries a fallback, and a
// daemon still restoring merely makes the go command extract some modules
// itself.
try {
  const stateFile = process.env[ENV_STATE_FILE];
  if (!stateFile) {
    core.info(
      `GoCICa module proxy was not started (${ENV_STATE_FILE} is unset). Nothing to wait for.`,
    );
  } else {
    const startedAt = Date.now();
    // The start step saw the daemon listening, so the state file existed then.
    // Missing now means `proxy-stop` removed it, or the daemon died: either
    // way there is nothing to wait for.
    const gone = () => {
      const state = readState(stateFile);

      return state === null || !isAlive(state);
    };
    const state = await waitForProxy(stateFile, gone, "ready");
    if (!state) {
      core.warning(
        "GoCICa module proxy did not become ready. Continuing; the go command falls back on its own.",
      );
    } else {
      core.info(
        `GoCICa module proxy ready on ${state.url} after ${Date.now() - startedAt}ms`,
      );
    }
  }
} catch (error) {
  const err = error as Error;
  core.warning(`Failed to wait for the GoCICa module proxy: ${err.message}`);
}
