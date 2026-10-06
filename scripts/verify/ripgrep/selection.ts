import type { FeatureConfig } from "@/scripts/tasks/features/ripgrep/generateConfig.js";
import { configPath, readConfig } from "@/scripts/tasks/features/ripgrep/generateConfig.js";
import { canonicalTag, imageRef } from "@/scripts/tasks/features/ripgrep/tags.js";

export interface Selection {
  version: string;
  ref: string;
}

const latestVersion = (config: FeatureConfig): string => {
  const matches = Object.keys(config.versions).filter((version) => config.versions[version].aliases.includes("latest"));
  if (matches.length !== 1) {
    throw new Error(`${configPath}: exactly one version must carry the latest alias, found ${matches.length}`);
  }
  return matches[0];
};

const derive = async (channel: string, prefix: string): Promise<Selection> => {
  const config = await readConfig();
  const version = latestVersion(config);
  return { version, ref: imageRef(prefix, canonicalTag(config, version, channel)) };
};

export const selection = { derive } as const;
