import core from "@actions/core";

import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import { install } from "./install";

const execAsync = promisify(exec);

try {
  const binPath = await install();
  core.addPath(path.dirname(binPath));

  const { stdout, stderr } = await execAsync("gocica -h", {});

  if (stdout) {
    core.info(stdout);
  }
  if (stderr) {
    core.info(stderr);
  }
} catch (error) {
  const err = error as Error;
  core.error(`Failed to run: ${error}, ${err.stack}`);
  core.setFailed(err.message);
}
