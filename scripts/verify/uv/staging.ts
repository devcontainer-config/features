import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { project$$ } from "@/scripts/shell.js";
import { paths } from "@/scripts/tasks/features/uv/paths.js";
import { loadSection, pythonPayloadPaths } from "@/scripts/tasks/features/uv/payload.js";

import type { Workspace } from "./lifecycle.js";
import type { Selection } from "./selection.js";

const featureSourcePath = path.join(projectRoot, ".devcontainer/features/src");

const stageFeatures = async (workspace: Workspace): Promise<void> => {
  const devcontainerPath = path.join(workspace.path, ".devcontainer");
  await cp(path.join(featureSourcePath, "features"), path.join(devcontainerPath, "features"), { recursive: true });
  await cp(path.join(featureSourcePath, "user-init"), path.join(devcontainerPath, "user-init"), { recursive: true });
};

const stageDownloadMirror = async (workspace: Workspace, selection: Selection, force: boolean): Promise<void> => {
  const args = [...["--component", "python"], ...["--version", selection.previous.key], ...(force ? ["--force"] : [])];
  await project$$`tsx scripts/tasks/features/uv/fetchPayload.ts ${args}`;
  const section = await loadSection("python", selection.previous.key);
  const payload = pythonPayloadPaths(section, paths.hostArch());
  const mirrorPath = path.join(workspace.path, "mirror", payload.build);
  await mkdir(mirrorPath, { recursive: true });
  await cp(payload.archive, path.join(mirrorPath, payload.name));
  await cp(payload.entry, path.join(workspace.path, "downloads.json"));
};

export const staging = {
  features: stageFeatures,
  downloadMirror: stageDownloadMirror,
} as const;
