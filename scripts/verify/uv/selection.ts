import { readFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import { claimedKey } from "@/scripts/tasks/features/config.js";
import type { Component, FeatureConfig, PythonVersion } from "@/scripts/tasks/features/uv/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/uv/generateConfig.js";
import type { DockerArch } from "@/scripts/tasks/features/uv/paths.js";
import { paths } from "@/scripts/tasks/features/uv/paths.js";
import { imageRef, tagNames } from "@/scripts/tasks/features/uv/tags.js";

import { remoteUser } from "./lifecycle.js";

const userInitFeaturePath = path.resolve(projectRoot, ".devcontainer/features/src/user-init/devcontainer-feature.json");
const dataRootSource = "XDG_DATA_HOME-${devcontainerId}";

const userInitFeatureSchema = z.object({
  mounts: z.array(z.object({ source: z.string(), target: z.string() })),
});

export interface ComponentImage {
  component: Component;
  key: string;
  ref: string;
}

export interface PythonImage extends ComponentImage {
  component: "python";
  pythonVersion: string;
}

export interface Selection {
  uv: ComponentImage;
  python: PythonImage;
  previous: PythonImage;
  xdgDataPath: string;
  machine: string;
  muslTriple: string;
}

const compareVersions = (left: string, right: string): number => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (const [index, part] of leftParts.entries()) {
    if (part !== rightParts[index]) {
      return part - rightParts[index];
    }
  }
  return 0;
};

const comparePython = (left: PythonVersion, right: PythonVersion): number =>
  compareVersions(left.pythonVersion, right.pythonVersion) || Number(left.build) - Number(right.build);

const previousPython = (config: FeatureConfig, latest: string): { key: string; entry: PythonVersion } => {
  const { versions } = config.components.python;
  const latestEntry = versions[latest];
  if (latestEntry === undefined) {
    throw new Error(`${configPath}: component python has no version ${latest}`);
  }
  const below = Object.entries(versions)
    .filter(([key, entry]) => key !== latest && comparePython(entry, latestEntry) < 0)
    .sort((left, right) => comparePython(left[1], right[1]));
  const previous = below.at(-1);
  if (previous === undefined) {
    throw new Error(`${configPath}: component python carries no version below ${latest}`);
  }
  const [key, entry] = previous;
  return { key, entry };
};

const componentImage = (
  config: FeatureConfig,
  component: Component,
  key: string,
  channel: string,
  prefix: string,
): ComponentImage => ({
  component,
  key,
  ref: imageRef(prefix, component, tagNames(config, component, key, channel).canonical),
});

const pythonImage = (config: FeatureConfig, key: string, channel: string, prefix: string): PythonImage => {
  const entry = config.components.python.versions[key];
  if (entry === undefined) {
    throw new Error(`${configPath}: component python has no version ${key}`);
  }
  return {
    component: "python",
    key,
    ref: imageRef(prefix, "python", tagNames(config, "python", key, channel).canonical),
    pythonVersion: entry.pythonVersion,
  };
};

const readXdgDataPath = async (): Promise<string> => {
  const data: unknown = JSON.parse(await readFile(userInitFeaturePath, "utf-8"));
  const result = userInitFeatureSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`${userInitFeaturePath}: ${z.prettifyError(result.error)}`);
  }
  const dataRoot = result.data.mounts.find((mount) => mount.source === dataRootSource)?.target;
  if (dataRoot === undefined) {
    throw new Error(`${userInitFeaturePath}: no mounts entry with source ${dataRootSource}`);
  }
  return posix.join(dataRoot, remoteUser);
};

const derive = async (channel: string, prefix: string): Promise<Selection> => {
  const config = await readConfig();
  const uvKey = claimedKey(config.components.uv.aliases, "latest", `${configPath} component uv`);
  const pythonKey = claimedKey(config.components.python.aliases, "latest", `${configPath} component python`);
  const previous = previousPython(config, pythonKey);
  const arch: DockerArch = paths.hostArch();
  return {
    uv: componentImage(config, "uv", uvKey, channel, prefix),
    python: pythonImage(config, pythonKey, channel, prefix),
    previous: pythonImage(config, previous.key, channel, prefix),
    xdgDataPath: await readXdgDataPath(),
    machine: paths.machineOf(arch),
    muslTriple: paths.muslTriples[arch],
  };
};

export const selection = { derive } as const;
