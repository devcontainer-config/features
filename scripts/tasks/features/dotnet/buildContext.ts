import { chmod, copyFile, link, mkdir, readdir, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";

import type { Component } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

const linkTree = async (source: string, target: string): Promise<void> => {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourceEntry = path.join(source, entry.name);
    const targetEntry = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await mkdir(targetEntry);
      await linkTree(sourceEntry, targetEntry);
    } else if (entry.isFile()) {
      await link(sourceEntry, targetEntry);
    } else if (entry.isSymbolicLink()) {
      await symlink(await readlink(sourceEntry), targetEntry);
    } else {
      throw new Error(`${sourceEntry}: unsupported payload entry`);
    }
  }
};

export const assembleBuildContext = async (
  component: Component,
  version: string,
  installBinaries: Partial<Record<DockerArch, string>>,
): Promise<string> => {
  const context = paths.contextPath(component, version);
  await rm(context, { recursive: true, force: true });
  await mkdir(path.join(context, "docker"), { recursive: true });
  await copyFile(path.join(projectRoot, "features/dotnet/Dockerfile"), path.join(context, "docker", "Dockerfile"));
  for (const arch of paths.dockerArchOptions) {
    const installBinary = installBinaries[arch];
    if (installBinary === undefined) {
      continue;
    }
    const stagedRoot = path.join(context, "linux", arch, "features", "dotnet");
    const staged = path.join(stagedRoot, component, version);
    await mkdir(staged, { recursive: true });
    await linkTree(paths.payloadPath(component, version, arch), staged);
    const install = path.join(stagedRoot, "install");
    await copyFile(installBinary, install);
    await chmod(install, 0o755);
  }
  return context;
};
