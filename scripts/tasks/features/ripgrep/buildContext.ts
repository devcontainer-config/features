import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { linkTree } from "@/scripts/tasks/features/linkTree.js";

import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

export const assembleBuildContext = async (key: string, arches: readonly DockerArch[]): Promise<string> => {
  const context = paths.contextPath(key);
  await rm(context, { recursive: true, force: true });
  await mkdir(path.join(context, "docker"), { recursive: true });
  await copyFile(path.join(projectRoot, "features/ripgrep/Dockerfile"), path.join(context, "docker", "Dockerfile"));
  for (const arch of arches) {
    const staged = path.join(context, "linux", arch, "features", "ripgrep");
    await mkdir(staged, { recursive: true });
    await linkTree(paths.payloadPath(key, arch), staged);
    await copyFile(path.join(projectRoot, "features/ripgrep/install"), path.join(staged, "install"));
  }
  return context;
};
