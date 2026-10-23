import path from "node:path";

import { project$$ } from "@/scripts/shell.js";

import type { Rid } from "./generateConfig.js";
import type { Assembly } from "./paths.js";
import { paths } from "./paths.js";

const packBinary = async (assembly: Assembly, rid: Rid, force: boolean): Promise<string> => {
  const binaryPath = path.join(paths.packPath(assembly, rid), assembly);
  if (!force && (await paths.isFile(binaryPath))) {
    return binaryPath;
  }
  await project$$`dotnet publish ${[
    ...["--configuration", "Release"],
    ...["--runtime", rid],
    `features/dotnet/${assembly}/${assembly}.csproj`,
    `-p:PublishDir=${paths.packPath(assembly, rid)}/`,
  ]}`;
  if (!(await paths.isFile(binaryPath))) {
    throw new Error(`dotnet publish did not produce ${binaryPath}`);
  }
  return binaryPath;
};

export const ensureBuildBinary = (rid: Rid, force: boolean): Promise<string> => packBinary("Build", rid, force);

export const ensureFeatureBinary = (rid: Rid, force: boolean): Promise<string> => packBinary("Feature", rid, force);
