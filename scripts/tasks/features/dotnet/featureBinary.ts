import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { extractTar } from "@/scripts/tasks/features/tar.js";

import { ensureFeatureBinary } from "./packBinary.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

const localBinary = async (arch: DockerArch): Promise<string> => {
  if (arch !== paths.hostArch()) {
    throw new Error(
      `--install-dir is required for the ${paths.ridFor(arch)} Feature binary: a local pack builds the host architecture only`,
    );
  }
  return ensureFeatureBinary(paths.ridFor(arch), false);
};

const archivedBinary = async (installDir: string, arch: DockerArch): Promise<string> => {
  const rid = paths.ridFor(arch);
  const archive = path.join(installDir, `${rid}.tar`);
  if (!(await paths.isFile(archive))) {
    throw new Error(`No ${rid} Feature archive at ${archive}`);
  }
  const directory = path.join(installDir, rid);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await extractTar(archive, directory);
  const binary = path.join(directory, "Feature");
  if (!(await paths.isFile(binary))) {
    throw new Error(`The ${rid} Feature archive has no Feature entry`);
  }
  return binary;
};

export const resolveFeatureBinaries = async (installDir?: string): Promise<Record<DockerArch, string>> => {
  const directory = installDir === undefined ? undefined : path.resolve(installDir);
  const binaries = {} as Record<DockerArch, string>;
  for (const arch of paths.dockerArchOptions) {
    binaries[arch] = directory === undefined ? await localBinary(arch) : await archivedBinary(directory, arch);
  }
  return binaries;
};
