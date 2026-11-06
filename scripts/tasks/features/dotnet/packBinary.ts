import path from "node:path";

import { project$$ } from "@/scripts/shell.js";

import type { Rid } from "../architecture.js";
import { isFile } from "../architecture.js";
import type { Assembly } from "./paths.js";
import { packPath } from "./paths.js";

const packBinary = async (assembly: Assembly, rid: Rid, force: boolean): Promise<string> => {
  const binaryPath = path.join(packPath(assembly, rid), assembly);
  if (!force && (await isFile(binaryPath))) {
    return binaryPath;
  }
  await project$$`dotnet publish ${[
    ...["--configuration", "Release"],
    ...["--runtime", rid],
    `features/dotnet/${assembly}/${assembly}.csproj`,
    `-p:PublishDir=${packPath(assembly, rid)}/`,
  ]}`;
  if (!(await isFile(binaryPath))) {
    throw new Error(`dotnet publish did not produce ${binaryPath}`);
  }
  return binaryPath;
};

export const ensureBuildBinary = (rid: Rid, force: boolean): Promise<string> => packBinary("Build", rid, force);

export const ensureFeatureBinary = (rid: Rid, force: boolean): Promise<string> => packBinary("Feature", rid, force);
