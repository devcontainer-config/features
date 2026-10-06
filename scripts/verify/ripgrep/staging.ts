import { cp } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";

import type { Workspace } from "./lifecycle.js";

const featureSourcePath = path.join(projectRoot, ".devcontainer/features/src");

const stageFeatures = async (workspace: Workspace): Promise<void> => {
  const devcontainerPath = path.join(workspace.path, ".devcontainer");
  await cp(path.join(featureSourcePath, "features"), path.join(devcontainerPath, "features"), { recursive: true });
  await cp(path.join(featureSourcePath, "user-init"), path.join(devcontainerPath, "user-init"), { recursive: true });
};

export const staging = { features: stageFeatures } as const;
