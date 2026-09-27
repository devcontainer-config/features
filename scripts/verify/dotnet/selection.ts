import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import type { Component, FeatureConfig } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { canonicalTag, imageRef } from "@/scripts/tasks/features/dotnet/tags.js";

const userInitFeaturePath = path.resolve(projectRoot, ".devcontainer/features/src/user-init/devcontainer-feature.json");

const userInitFeatureSchema = z.object({ containerEnv: z.object({ XDG_DATA_HOME: z.string() }) });

export interface ComponentImage {
  component: Component;
  version: string;
  ref: string;
}

export interface Selection {
  components: Record<Component, ComponentImage>;
  tfm: string;
  globalPackagesPath: string;
}

const ltsVersion = (config: FeatureConfig, component: Component): string => {
  const versions = config.components[component].versions;
  const matches = Object.keys(versions).filter((version) => versions[version].aliases.includes("lts"));
  if (matches.length !== 1) {
    throw new Error(`${configPath}: component ${component} must have exactly one lts version, found ${matches.length}`);
  }
  return matches[0];
};

const componentImage = (
  config: FeatureConfig,
  component: Component,
  channel: string,
  prefix: string,
): ComponentImage => {
  const version = ltsVersion(config, component);
  return { component, version, ref: imageRef(prefix, component, canonicalTag(config, component, version, channel)) };
};

const tfmOf = (sdkVersion: string): string => {
  const match = /^(\d+)\.(\d+)\./.exec(sdkVersion);
  if (match === null) {
    throw new Error(`Cannot derive the target framework from the sdk version ${sdkVersion}`);
  }
  return `net${match[1]}.${match[2]}`;
};

const readGlobalPackagesPath = async (): Promise<string> => {
  const data: unknown = JSON.parse(await readFile(userInitFeaturePath, "utf-8"));
  const result = userInitFeatureSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`${userInitFeaturePath}: ${z.prettifyError(result.error)}`);
  }
  return `${result.data.containerEnv.XDG_DATA_HOME}/NuGet/global-packages`;
};

const derive = async (channel: string, prefix: string): Promise<Selection> => {
  const config = await readConfig();
  const sdk = componentImage(config, "sdk", channel, prefix);
  return {
    components: {
      sdk,
      runtime: componentImage(config, "runtime", channel, prefix),
      aspnet: componentImage(config, "aspnet", channel, prefix),
    },
    tfm: tfmOf(sdk.version),
    globalPackagesPath: await readGlobalPackagesPath(),
  };
};

export const selection = { derive } as const;
