import path from "node:path";

import { ensurePackBinary } from "./packBinary.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

const localBinary = async (arch: DockerArch): Promise<string> => {
  if (arch !== paths.hostArch()) {
    throw new Error(
      `--install-dir is required for the ${paths.ridFor(arch)} install binary: a local pack builds the host architecture only`,
    );
  }
  return ensurePackBinary("install", paths.ridFor(arch), false);
};

export const resolveInstallBinaries = async (installDir?: string): Promise<Record<DockerArch, string>> => {
  const binaries = {} as Record<DockerArch, string>;
  for (const arch of paths.dockerArchOptions) {
    const binaryPath =
      installDir === undefined ? await localBinary(arch) : path.join(installDir, paths.ridFor(arch), "install");
    if (!(await paths.isFile(binaryPath))) {
      throw new Error(`No ${paths.ridFor(arch)} install binary at ${binaryPath}`);
    }
    binaries[arch] = binaryPath;
  }
  return binaries;
};
