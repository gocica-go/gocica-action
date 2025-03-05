import core from "@actions/core";

import { exec } from "child_process";
import { promisify } from "util";

import { install } from "./install";
import path from "path";

const execAsync = promisify(exec);

try {
  const binPath = await install();

  const { stdout, stderr } = await execAsync(`${binPath} -h`, {});
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
