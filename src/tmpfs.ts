import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";
import { mkdir, readFile } from "fs/promises";
import os from "os";
import path from "path";

export const STATE_TMPFS = "gocica-tmpfs";

// Below this much available memory the mount is skipped: the caches take a few
// GB (measured 2.5-3GB for a 400-module project) and the build needs its own.
const MIN_AVAILABLE_BYTES = 8 * 1024 ** 3;

/**
 * Mount a tmpfs for the caches when asked to, and return the mount point.
 *
 * Restoring the module cache in extracted form is ~50k small files, and on the
 * runner's OS disk that is disk-bound: measured on ubuntu-latest it takes 2-5s
 * there against 0.5-0.9s in RAM, and it slows everything else writing to the
 * same disk while it runs -- actions/setup-go's own copy of the toolchain
 * tripled. Opt-in, because it pins that RAM for the whole job.
 *
 * Every reason not to mount is an info line, never a failure: the caches then
 * live on disk exactly as they did before.
 */
export async function mountTmpfs(): Promise<string | null> {
  if (!core.getBooleanInput("tmpfs")) {
    return null;
  }

  if (process.platform !== "linux") {
    core.info(
      `tmpfs is Linux only; the caches stay on disk on ${process.platform}.`,
    );

    return null;
  }

  const available = await memAvailable();
  if (available !== null && available < MIN_AVAILABLE_BYTES) {
    core.info(
      `${gib(available)} GiB of memory available, ${gib(MIN_AVAILABLE_BYTES)} GiB needed; the caches stay on disk.`,
    );

    return null;
  }

  if (!(await canSudo())) {
    core.info("passwordless sudo is not available; the caches stay on disk.");

    return null;
  }

  const size = core.getInput("tmpfs-size") || "10g";
  const mount = path.join(
    process.env.RUNNER_TEMP || os.tmpdir(),
    "gocica-tmpfs",
  );
  await mkdir(mount, { recursive: true });

  // size is a ceiling, not a reservation: tmpfs only takes what is written.
  // uid/gid make the mount the runner user's without a chown afterwards.
  const uid = process.getuid?.() ?? 0;
  const gid = process.getgid?.() ?? 0;
  const options = `size=${size},uid=${uid},gid=${gid},mode=0755,nosuid,nodev`;

  const { exitCode, stderr } = await getExecOutput(
    "sudo",
    ["-n", "mount", "-t", "tmpfs", "-o", options, "tmpfs", mount],
    { ignoreReturnCode: true },
  );
  if (exitCode !== 0) {
    core.warning(
      `Failed to mount a tmpfs at ${mount}: ${stderr.trim()}. The caches stay on disk.`,
    );

    return null;
  }

  core.saveState(STATE_TMPFS, mount);
  core.info(`Caches on tmpfs at ${mount} (size ${size})`);

  return mount;
}

/**
 * Unmount what mountTmpfs mounted. Best effort: on a hosted runner the VM is
 * discarded anyway, on a self-hosted one a forgotten mount would keep its RAM.
 */
export async function unmountTmpfs(mount: string): Promise<void> {
  const { exitCode, stderr } = await getExecOutput(
    "sudo",
    ["-n", "umount", mount],
    { ignoreReturnCode: true },
  );
  if (exitCode !== 0) {
    core.warning(`Failed to unmount ${mount}: ${stderr.trim()}`);
  }
}

async function canSudo(): Promise<boolean> {
  try {
    const { exitCode } = await getExecOutput("sudo", ["-n", "true"], {
      ignoreReturnCode: true,
      silent: true,
    });

    return exitCode === 0;
  } catch {
    // No sudo binary at all.
    return false;
  }
}

// MemAvailable rather than os.freemem(): on Linux the latter is MemFree, which
// the page cache drives towards zero on any runner that has done some work.
async function memAvailable(): Promise<number | null> {
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const match = /^MemAvailable:\s+(\d+) kB/m.exec(meminfo);

    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

function gib(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}
