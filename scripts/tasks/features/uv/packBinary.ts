import path from "node:path";

import { project$$ } from "@/scripts/shell.js";

import type { Rid } from "../architecture.js";
import { isFile } from "../architecture.js";
import { packPath } from "./paths.js";

export const ensureFeatureBinary = async (rid: Rid, force: boolean): Promise<string> => {
  const binaryPath = path.join(packPath(rid), "Feature");
  if (!force && (await isFile(binaryPath))) {
    return binaryPath;
  }
  await project$$`dotnet publish ${[
    ...["--configuration", "Release"],
    ...["--runtime", rid],
    "features/uv/Feature/Feature.csproj",
    `-p:PublishDir=${packPath(rid)}/`,
  ]}`;
  if (!(await isFile(binaryPath))) {
    throw new Error(`dotnet publish did not produce ${binaryPath}`);
  }
  return binaryPath;
};
