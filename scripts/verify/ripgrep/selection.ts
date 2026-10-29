import { claimedKey } from "@/scripts/tasks/features/config.js";
import type { FeatureConfig } from "@/scripts/tasks/features/ripgrep/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/ripgrep/generateConfig.js";
import { imageRef, tagNames } from "@/scripts/tasks/features/ripgrep/tags.js";

export interface Selection {
  key: string;
  ref: string;
}

const latestKey = (config: FeatureConfig): string => claimedKey(config.aliases, "latest", configPath);

const derive = async (channel: string, prefix: string): Promise<Selection> => {
  const config = await readConfig();
  const key = latestKey(config);
  return { key, ref: imageRef(prefix, tagNames(config, key, channel).canonical) };
};

export const selection = { derive } as const;
