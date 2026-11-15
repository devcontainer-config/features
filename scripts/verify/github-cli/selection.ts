import { claimedKey } from "@/scripts/tasks/features/config.js";
import { documentOf, githubCli as githubCliFeature } from "@/scripts/tasks/features/github-cli/feature.js";
import type { FeatureConfig } from "@/scripts/tasks/features/github-cli/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/github-cli/generateConfig.js";
import { imageEntry } from "@/scripts/tasks/features/imageEntries.js";

import type { ComponentImage } from "../lifecycle.js";

export type Selection = ComponentImage;

const selectedKey = (config: FeatureConfig, key: string | undefined): string =>
  key ?? claimedKey(config.aliases, "latest", configPath);

const derive = async (channel: string, prefix: string, key?: string): Promise<Selection> => {
  const config = await readConfig();
  const selected = selectedKey(config, key);
  const { canonical } = imageEntry(githubCliFeature, documentOf(config), prefix, channel, {
    component: "github-cli",
    key: selected,
  });
  return { component: "github-cli", key: selected, ref: canonical };
};

export const selection = { derive } as const;
