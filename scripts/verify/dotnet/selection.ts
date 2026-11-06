import { readFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import { claimedKey } from "@/scripts/tasks/features/config.js";
import { documentOf, dotnet as dotnetFeature } from "@/scripts/tasks/features/dotnet/feature.js";
import type { Component, FeatureConfig } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { imageEntry } from "@/scripts/tasks/features/imageEntries.js";

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

export interface SelectionTarget {
  component: Component;
  key: string;
}

export interface Selection {
  components: Record<Component, ComponentImage>;
  tfm: string;
  globalPackagesPath: string;
}

const componentImage = (
  config: FeatureConfig,
  component: Component,
  key: string | undefined,
  channel: string,
  prefix: string,
): ComponentImage => {
  const selected =
    key ?? claimedKey(config.components[component].aliases, "lts", `${configPath} component ${component}`);
  const { canonical } = imageEntry(dotnetFeature, documentOf(config), prefix, channel, { component, key: selected });
  return { component, key: selected, ref: canonical };
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
  const dataRoot = result.data.mounts.find((mount) => mount.source === dataRootSource)?.target;
  if (dataRoot === undefined) {
    throw new Error(`${userInitFeaturePath}: no mounts entry with source ${dataRootSource}`);
  }
  return posix.join(dataRoot, remoteUser, "NuGet/global-packages");
};

const derive = async (channel: string, prefix: string, target?: SelectionTarget): Promise<Selection> => {
  const config = await readConfig();
  const keyOf = (component: Component): string | undefined =>
    target?.component === component ? target.key : undefined;
  const sdk = componentImage(config, "sdk", keyOf("sdk"), channel, prefix);
  return {
    components: {
      sdk,
      runtime: componentImage(config, "runtime", keyOf("runtime"), channel, prefix),
      aspnet: componentImage(config, "aspnet", keyOf("aspnet"), channel, prefix),
    },
    tfm: tfmOf(sdk.key),
    globalPackagesPath: await readGlobalPackagesPath(),
  };
};

export const selection = { derive } as const;
