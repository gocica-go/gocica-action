import core from "@actions/core";

import { install } from "./install";

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

  const remote = core.getInput("remote");
  if (remote) {
    flags.push("--remote", remote);
  }

  // S3 settings
  const s3Region = core.getInput("s3-region");
  if (s3Region) {
    flags.push("--s3.region", s3Region);
  }

  const s3Bucket = core.getInput("s3-bucket");
  if (s3Bucket) {
    flags.push("--s3.bucket", s3Bucket);
  }

  const s3AccessKey = core.getInput("s3-access-key");
  if (s3AccessKey) {
    flags.push("--s3.access-key", s3AccessKey);
  }

  const s3SecretAccessKey = core.getInput("s3-secret-access-key");
  if (s3SecretAccessKey) {
    flags.push("--s3.secret-access-key", s3SecretAccessKey);
  }

  const s3Endpoint = core.getInput("s3-endpoint");
  if (s3Endpoint) {
    flags.push("--s3.endpoint", s3Endpoint);
  }

  const s3DisableSSL = core.getInput("s3-disable-ssl");
  if (s3DisableSSL && s3DisableSSL.toLowerCase() === "true") {
    flags.push("--s3.disable-ssl");
  }

  const s3UsePathStyle = core.getInput("s3-use-path-style");
  if (s3UsePathStyle && s3UsePathStyle.toLowerCase() === "true") {
    flags.push("--s3.use-path-style");
  }

  return flags;
}

try {
  const binPath = await install();
  const flags = buildFlags();
  const command = flags.length > 0 ? `${binPath} ${flags.join(" ")}` : binPath;

  core.exportVariable("GOCACHEPROG", command);
  core.exportVariable(
    "ACTIONS_RUNTIME_TOKEN",
    process.env.ACTIONS_RUNTIME_TOKEN,
  );
  core.exportVariable("ACTIONS_RESULTS_URL", process.env.ACTIONS_RESULTS_URL);
} catch (error) {
  const err = error as Error;
  core.error(`Failed to run: ${error}, ${err.stack}`);
  core.setFailed(err.message);
}
