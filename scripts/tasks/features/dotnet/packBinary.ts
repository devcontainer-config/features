import path from "node:path";

import { project$$ } from "@/scripts/shell.js";

import type { Rid } from "./generateConfig.js";
import type { Assembly } from "./paths.js";
import { paths } from "./paths.js";

const projects: Record<Assembly, string> = { build: "Build", install: "Install" };

export const ensurePackBinary = async (assembly: Assembly, rid: Rid, force: boolean): Promise<string> => {
  const binaryPath = path.join(paths.packPath(assembly, rid), assembly);
  if (!force && (await paths.isFile(binaryPath))) {
    return binaryPath;
  }
  const project = projects[assembly];
  await project$$`dotnet publish ${[
    ...["--configuration", "Release"],
    ...["--runtime", rid],
    `features/dotnet/${project}/${project}.csproj`,
    `-p:PublishDir=${paths.packPath(assembly, rid)}/`,
  ]}`;
  if (!(await paths.isFile(binaryPath))) {
    throw new Error(`dotnet publish did not produce ${binaryPath}`);
  }
  return binaryPath;
};
