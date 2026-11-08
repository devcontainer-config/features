import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { project$$ } from "@/scripts/shell.js";

import type { DockerArch, Rid } from "./architecture.js";
import { dockerArchOptions, hostArch, isFile, ridFor } from "./architecture.js";
import type { Feature } from "./feature.js";
import { requireBinary } from "./feature.js";
import { extractTar } from "./tar.js";

export const ensureFeatureBinary = async (
  csproj: string,
  directory: string,
  rid: Rid,
  force: boolean,
): Promise<string> => {
  const binaryPath = path.join(directory, "Feature");
  if (!force && (await isFile(binaryPath))) {
    return binaryPath;
  }
  await project$$`dotnet publish ${[
    ...["--configuration", "Release"],
    ...["--runtime", rid],
    csproj,
    `-p:PublishDir=${directory}/`,
  ]}`;
  if (!(await isFile(binaryPath))) {
    throw new Error(`dotnet publish did not produce ${binaryPath}`);
  }
  return binaryPath;
};

const localBinary = async (binary: NonNullable<Feature["binary"]>, arch: DockerArch): Promise<string> => {
  if (arch !== hostArch()) {
    throw new Error(
      `--install-dir is required for the ${ridFor(arch)} Feature binary: a local pack builds the host architecture only`,
    );
  }
  return binary.ensure(ridFor(arch), false);
};

const archivedBinary = async (installDir: string, arch: DockerArch): Promise<string> => {
  const rid = ridFor(arch);
  const archive = path.join(installDir, `${rid}.tar`);
  if (!(await isFile(archive))) {
    throw new Error(`No ${rid} Feature archive at ${archive}`);
  }
  const directory = path.join(installDir, rid);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await extractTar(archive, directory);
  const binary = path.join(directory, "Feature");
  if (!(await isFile(binary))) {
    throw new Error(`The ${rid} Feature archive has no Feature entry`);
  }
  return binary;
};

export const resolveFeatureBinaries = async (
  feature: Feature,
  installDir?: string,
): Promise<Record<DockerArch, string>> => {
  const binary = requireBinary(feature);
  const directory = installDir === undefined ? undefined : path.resolve(installDir);
  const binaries = {} as Record<DockerArch, string>;
  for (const arch of dockerArchOptions) {
    binaries[arch] = directory === undefined ? await localBinary(binary, arch) : await archivedBinary(directory, arch);
  }
  return binaries;
};
