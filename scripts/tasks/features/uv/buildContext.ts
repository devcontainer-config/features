import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { linkTree } from "@/scripts/tasks/features/linkTree.js";

import type { Component } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

export const assembleBuildContext = async (
  component: Component,
  version: string,
  arches: readonly DockerArch[],
  featureBinaries: Partial<Record<DockerArch, string>>,
): Promise<string> => {
  const context = paths.contextPath(component, version);
  await rm(context, { recursive: true, force: true });
  await mkdir(path.join(context, "docker"), { recursive: true });
  await copyFile(path.join(projectRoot, "features/uv/Dockerfile"), path.join(context, "docker", "Dockerfile"));
  for (const arch of arches) {
    const stagedRoot = path.join(context, "linux", arch, "features", "uv");
    if (component === "uv") {
      const featureBinary = featureBinaries[arch];
      if (featureBinary === undefined) {
        throw new Error(`No Feature binary for ${arch}`);
      }
      await mkdir(path.join(stagedRoot, "uv"), { recursive: true });
      await linkTree(paths.payloadPath(component, version, arch), path.join(stagedRoot, "uv"));
      await copyFile(path.join(projectRoot, "features/uv/install"), path.join(stagedRoot, "install"));
      await copyFile(path.join(projectRoot, "features/uv/onCreate"), path.join(stagedRoot, "onCreate"));
      await copyFile(featureBinary, path.join(stagedRoot, "Feature"));
    } else {
      await mkdir(path.join(stagedRoot, "python"), { recursive: true });
      await linkTree(paths.payloadPath(component, version, arch), path.join(stagedRoot, "python"));
    }
  }
  return context;
};
