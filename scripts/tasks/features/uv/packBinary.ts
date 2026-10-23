import path from "node:path";

import { project$$ } from "@/scripts/shell.js";

import type { Rid } from "./generateConfig.js";
import { paths } from "./paths.js";

export const ensureFeatureBinary = async (rid: Rid, force: boolean): Promise<string> => {
  const binaryPath = path.join(paths.packPath(rid), "Feature");
  if (!force && (await paths.isFile(binaryPath))) {
    return binaryPath;
  }
  await project$$`dotnet publish ${[
    ...["--configuration", "Release"],
    ...["--runtime", rid],
    "features/uv/Feature/Feature.csproj",
    `-p:PublishDir=${paths.packPath(rid)}/`,
  ]}`;
  if (!(await paths.isFile(binaryPath))) {
    throw new Error(`dotnet publish did not produce ${binaryPath}`);
  }
  return binaryPath;
};
