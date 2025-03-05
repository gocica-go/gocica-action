import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { chmod } from "fs/promises";
import os from "os";

/**
 * Install GoCICa.
 *
 * @returns             path to installed binary of GoCICa.
 */
export async function install(): Promise<string> {
  const version = core.getInput("version") || "latest";

  core.info(`Installing GoCICa binary ${version}...`);

  const startedAt = Date.now();

  const assetURL = getAssetURL(version);

  core.info(`Downloading binary ${assetURL} ...`);

  const binPath = await tc.downloadTool(assetURL);
  await chmod(binPath, 0o755);

  core.info(`Installed GoCICa into ${binPath} in ${Date.now() - startedAt}ms`);

  return binPath;
}

function getAssetURL(version: string): string {
  let ext = "";
  let platform = os.platform().toString();
  switch (platform) {
    case "win32":
      platform = "Windows";
      ext = ".exe";
      break;
    case "darwin":
      platform = "Darwin";
      break;
    case "linux":
      platform = "Linux";
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let arch = os.arch();
  switch (arch) {
    case "arm64":
      arch = "arm64";
      break;
    case "x64":
      arch = "x86_64";
      break;
    case "x32":
    case "ia32":
      arch = "i386";
      break;
  }

  if (version === "latest") {
    return `https://github.com/gocica-go/gocica/releases/latest/download/gocica_${platform}_${arch}${ext}`;
  }
  return `https://github.com/gocica-go/gocica/releases/download/${version}/gocica_${platform}_${arch}${ext}`;
}
