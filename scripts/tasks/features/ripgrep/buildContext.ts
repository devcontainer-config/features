import { chmod, copyFile, link, mkdir, readdir, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";

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

export const assembleBuildContext = async (version: string, arches: readonly DockerArch[]): Promise<string> => {
  const context = paths.contextPath(version);
  await rm(context, { recursive: true, force: true });
  await mkdir(path.join(context, "docker"), { recursive: true });
  await copyFile(path.join(projectRoot, "features/ripgrep/Dockerfile"), path.join(context, "docker", "Dockerfile"));
  for (const arch of arches) {
    const staged = path.join(context, "linux", arch, "features", "ripgrep");
    await mkdir(staged, { recursive: true });
    await linkTree(paths.payloadPath(version, arch), staged);
    const install = path.join(staged, "install");
    await copyFile(path.join(projectRoot, "features/ripgrep/install"), install);
    await chmod(install, 0o755);
  }
  return context;
};
