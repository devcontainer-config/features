import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { linkTree } from "@/scripts/tasks/features/linkTree.js";

import type { Component } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

export const assembleBuildContext = async (
  component: Component,
  key: string,
  featureBinaries: Partial<Record<DockerArch, string>>,
): Promise<string> => {
  const context = paths.contextPath(component, key);
  await rm(context, { recursive: true, force: true });
  await mkdir(path.join(context, "docker"), { recursive: true });
  await copyFile(path.join(projectRoot, "features/dotnet/Dockerfile"), path.join(context, "docker", "Dockerfile"));
  for (const arch of paths.dockerArchOptions) {
    const featureBinary = featureBinaries[arch];
    if (featureBinary === undefined) {
      continue;
    }
    const stagedRoot = path.join(context, "linux", arch, "features", "dotnet");
    const staged = path.join(stagedRoot, component, key);
    await mkdir(staged, { recursive: true });
    await linkTree(paths.payloadPath(component, key, arch), staged);
    await copyFile(path.join(projectRoot, "features/dotnet/install"), path.join(stagedRoot, "install"));
    await copyFile(featureBinary, path.join(stagedRoot, "Feature"));
  }
  return context;
};
