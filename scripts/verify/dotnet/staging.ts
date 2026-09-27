import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";

import type { Workspace } from "./lifecycle.js";

const assetsPath = path.join(import.meta.dirname, "assets");
const featureSourcePath = path.join(projectRoot, ".devcontainer/features/src");

const stageFeatures = async (workspace: Workspace): Promise<void> => {
  const devcontainerPath = path.join(workspace.path, ".devcontainer");
  await cp(path.join(featureSourcePath, "features"), path.join(devcontainerPath, "features"), { recursive: true });
  await cp(path.join(featureSourcePath, "user-init"), path.join(devcontainerPath, "user-init"), { recursive: true });
};

const stageAssets = async (
  workspace: Workspace,
  assets: readonly string[],
  directories: readonly string[],
): Promise<void> => {
  for (const asset of assets) {
    await cp(path.join(assetsPath, asset), path.join(workspace.path, asset), { recursive: true });
  }
  for (const directory of directories) {
    await mkdir(path.join(workspace.path, directory), { recursive: true });
  }
};

const stageApp = async (workspace: Workspace, sourcePath: string): Promise<void> => {
  await cp(sourcePath, path.join(workspace.path, "app"), { recursive: true });
};

export const staging = {
  features: stageFeatures,
  assets: stageAssets,
  app: stageApp,
} as const;
