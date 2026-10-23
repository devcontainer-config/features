import { readFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import type { Component, FeatureConfig } from "@/scripts/tasks/features/uv/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/uv/generateConfig.js";
import type { DockerArch } from "@/scripts/tasks/features/uv/paths.js";
import { paths } from "@/scripts/tasks/features/uv/paths.js";
import { canonicalTag, imageRef } from "@/scripts/tasks/features/uv/tags.js";

import { remoteUser } from "./lifecycle.js";

const userInitFeaturePath = path.resolve(projectRoot, ".devcontainer/features/src/user-init/devcontainer-feature.json");
const dataRootSource = "XDG_DATA_HOME-${devcontainerId}";

const userInitFeatureSchema = z.object({
  mounts: z.array(z.object({ source: z.string(), target: z.string() })),
});

export interface ComponentImage {
  component: Component;
  version: string;
  ref: string;
}

export interface Selection {
  uv: ComponentImage;
  python: ComponentImage;
  previous: ComponentImage;
  xdgDataPath: string;
  machine: string;
  muslTriple: string;
}

const latestVersion = (config: FeatureConfig, component: Component): string => {
  const versions = config.components[component].versions;
  const matches = Object.keys(versions).filter((version) => versions[version].aliases.includes("latest"));
  if (matches.length !== 1) {
    throw new Error(
      `${configPath}: component ${component} must have exactly one latest version, found ${matches.length}`,
    );
  }
  return matches[0];
};

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

const previousPythonVersion = (config: FeatureConfig, latest: string): string => {
  const versions = Object.keys(config.components.python.versions).filter(
    (version) => compareVersions(version, latest) < 0,
  );
  versions.sort(compareVersions);
  const previous = versions.at(-1);
  if (previous === undefined) {
    throw new Error(`${configPath}: component python carries no version below ${latest}`);
  }
  return previous;
};

const componentImage = (
  config: FeatureConfig,
  component: Component,
  version: string,
  channel: string,
  prefix: string,
): ComponentImage => ({
  component,
  version,
  ref: imageRef(prefix, component, canonicalTag(config, component, version, channel)),
});

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
  const uvVersion = latestVersion(config, "uv");
  const pythonVersion = latestVersion(config, "python");
  const arch: DockerArch = paths.hostArch();
  return {
    uv: componentImage(config, "uv", uvVersion, channel, prefix),
    python: componentImage(config, "python", pythonVersion, channel, prefix),
    previous: componentImage(config, "python", previousPythonVersion(config, pythonVersion), channel, prefix),
    xdgDataPath: await readXdgDataPath(),
    machine: paths.machineOf(arch),
    muslTriple: paths.muslTriples[arch],
  };
};

export const selection = { derive } as const;
