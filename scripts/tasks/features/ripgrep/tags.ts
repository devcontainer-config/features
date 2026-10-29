import type { TagSet, TagSource } from "@/scripts/tasks/features/tags.js";
import { tagNames as baseTagNames } from "@/scripts/tasks/features/tags.js";

import type { FeatureConfig } from "./generateConfig.js";

const sourceOf = (config: FeatureConfig, key: string): TagSource => {
  const entry = config.versions[key];
  if (entry === undefined) {
    const available = Object.keys(config.versions).join(", ");
    throw new Error(`Version ${key} is not tracked (available: ${available})`);
  }
  return { key, revision: config.revision, aliases: config.aliases[key] };
};

export const tagNames = (config: FeatureConfig, key: string, channel: string): TagSet =>
  baseTagNames(sourceOf(config, key), channel);

export const imageRef = (prefix: string, tag: string): string => `${prefix}/ripgrep:${tag}`;

export const imageRefs = (prefix: string, tags: readonly string[]): string[] =>
  tags.map((tag) => imageRef(prefix, tag));
