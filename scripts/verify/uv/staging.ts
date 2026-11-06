import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import { project$$ } from "@/scripts/shell.js";
import { hostArch } from "@/scripts/tasks/features/architecture.js";
import { derive, loadSection } from "@/scripts/tasks/features/uv/payload.js";

import type { Workspace } from "../lifecycle.js";
import type { Selection } from "./selection.js";
import { previousOf } from "./selection.js";

const stageDownloadMirror = async (workspace: Workspace, selection: Selection, force: boolean): Promise<void> => {
  const key = previousOf(selection).key;
  const args = [...["--feature", "uv"], ...["--component", "python"], ...["--version", key]];
  await project$$`tsx scripts/tasks/features/pipeline.ts fetch-payload ${args} ${force ? ["--force"] : []}`;
  const payload = derive(await loadSection("python", key), hostArch());
  const mirrorPath = path.join(workspace.path, "mirror", payload.build);
  await mkdir(mirrorPath, { recursive: true });
  await cp(payload.archivePath, path.join(mirrorPath, payload.archive.name));
  await cp(payload.entryPath, path.join(workspace.path, "downloads.json"));
};

export const staging = { downloadMirror: stageDownloadMirror } as const;
