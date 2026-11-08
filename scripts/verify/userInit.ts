import { readFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";

import { remoteUser } from "./lifecycle.js";

const featurePath = path.resolve(projectRoot, ".devcontainer/features/src/user-init/devcontainer-feature.json");
const containerId = "${devcontainerId}";

const featureSchema = z.object({
  mounts: z.array(z.object({ source: z.string(), target: z.string() })),
});

const readMounts = async (): Promise<readonly { source: string; target: string }[]> => {
  const data: unknown = JSON.parse(await readFile(featurePath, "utf-8"));
  const result = featureSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`${featurePath}: ${z.prettifyError(result.error)}`);
  }
  return result.data.mounts;
};

const xdgRoot = async (variable: string): Promise<string> => {
  const source = `${variable}-${containerId}`;
  const root = (await readMounts()).find((mount) => mount.source === source)?.target;
  if (root === undefined) {
    throw new Error(`${featurePath}: no mounts entry with source ${source}`);
  }
  return root;
};

const xdgPath = async (variable: string): Promise<string> => posix.join(await xdgRoot(variable), remoteUser);

export const userInit = { xdgRoot, xdgPath } as const;
