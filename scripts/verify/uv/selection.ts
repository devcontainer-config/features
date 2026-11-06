import { readFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import { hostArch } from "@/scripts/tasks/features/architecture.js";
import { claimedKey } from "@/scripts/tasks/features/config.js";
import { imageEntry } from "@/scripts/tasks/features/imageEntries.js";
import { documentOf, uv as uvFeature } from "@/scripts/tasks/features/uv/feature.js";
import type { Component, FeatureConfig, PythonVersion } from "@/scripts/tasks/features/uv/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/uv/generateConfig.js";
import { machineOf, muslTriples } from "@/scripts/tasks/features/uv/paths.js";

import { remoteUser } from "../lifecycle.js";

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

export interface SelectionTarget {
  component: Component;
  key: string;
}

export interface Selection {
  uv: ComponentImage;
  python: PythonImage;
  previous: PythonImage | undefined;
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

const refOf = (config: FeatureConfig, component: Component, key: string, channel: string, prefix: string): string =>
  imageEntry(uvFeature, documentOf(config), prefix, channel, { component, key }).canonical;

const componentImage = (
  config: FeatureConfig,
  component: Component,
  key: string,
  channel: string,
  prefix: string,
): ComponentImage => ({ component, key, ref: refOf(config, component, key, channel, prefix) });

const pythonImage = (config: FeatureConfig, key: string, channel: string, prefix: string): PythonImage => {
  const entry = config.components.python.versions[key];
  if (entry === undefined) {
    throw new Error(`${configPath}: component python has no version ${key}`);
  }
  return {
    component: "python",
    key,
    ref: refOf(config, "python", key, channel, prefix),
    pythonVersion: entry.pythonVersion,
  };
};

const previousPython = (
  config: FeatureConfig,
  latest: string,
  channel: string,
  prefix: string,
): PythonImage | undefined => {
  const latestEntry = config.components.python.versions[latest];
  if (latestEntry === undefined) {
    throw new Error(`${configPath}: component python has no version ${latest}`);
  }
  const below = Object.entries(config.components.python.versions)
    .filter(([key, entry]) => key !== latest && comparePython(entry, latestEntry) < 0)
    .sort((left, right) => comparePython(left[1], right[1]));
  const previous = below.at(-1);
  return previous === undefined ? undefined : pythonImage(config, previous[0], channel, prefix);
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

const derive = async (channel: string, prefix: string, target?: SelectionTarget): Promise<Selection> => {
  const config = await readConfig();
  const uvKey =
    target?.component === "uv"
      ? target.key
      : claimedKey(config.components.uv.aliases, "latest", `${configPath} component uv`);
  const pythonKey =
    target?.component === "python"
      ? target.key
      : claimedKey(config.components.python.aliases, "latest", `${configPath} component python`);
  const arch = hostArch();
  return {
    uv: componentImage(config, "uv", uvKey, channel, prefix),
    python: pythonImage(config, pythonKey, channel, prefix),
    previous: previousPython(config, pythonKey, channel, prefix),
    xdgDataPath: await readXdgDataPath(),
    machine: machineOf(arch),
    muslTriple: muslTriples[arch],
  };
};

export const previousOf = (selection: Selection): PythonImage => {
  if (selection.previous === undefined) {
    throw new Error(`${configPath}: component python carries no version below ${selection.python.key}`);
  }
  return selection.previous;
};

export const selection = { derive, previousOf } as const;
