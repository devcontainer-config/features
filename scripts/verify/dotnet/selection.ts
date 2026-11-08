import { posix } from "node:path";

import { claimedKey } from "@/scripts/tasks/features/config.js";
import { documentOf, dotnet as dotnetFeature } from "@/scripts/tasks/features/dotnet/feature.js";
import type { Component, FeatureConfig } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { imageEntry } from "@/scripts/tasks/features/imageEntries.js";

import { userInit } from "../userInit.js";

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

const readGlobalPackagesPath = async (): Promise<string> =>
  posix.join(await userInit.xdgPath("XDG_DATA_HOME"), "NuGet/global-packages");

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
