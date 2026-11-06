import { claimedKey } from "@/scripts/tasks/features/config.js";
import { imageEntry } from "@/scripts/tasks/features/imageEntries.js";
import { documentOf, ripgrep as ripgrepFeature } from "@/scripts/tasks/features/ripgrep/feature.js";
import type { FeatureConfig } from "@/scripts/tasks/features/ripgrep/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/ripgrep/generateConfig.js";

import type { ComponentImage } from "../lifecycle.js";

export type Selection = ComponentImage;

const selectedKey = (config: FeatureConfig, key: string | undefined): string =>
  key ?? claimedKey(config.aliases, "latest", configPath);

const derive = async (channel: string, prefix: string, key?: string): Promise<Selection> => {
  const config = await readConfig();
  const selected = selectedKey(config, key);
  const { canonical } = imageEntry(ripgrepFeature, documentOf(config), prefix, channel, {
    component: "ripgrep",
    key: selected,
  });
  return { component: "ripgrep", key: selected, ref: canonical };
};

export const selection = { derive } as const;
