import type { TagSource } from "@/scripts/tasks/features/tags.js";
import { canonicalTag as baseCanonicalTag, tagNames as baseTagNames } from "@/scripts/tasks/features/tags.js";

import type { FeatureConfig } from "./generateConfig.js";

const sourceOf = (config: FeatureConfig, version: string): TagSource => {
  const entry = config.versions[version];
  if (entry === undefined) {
    const available = Object.keys(config.versions).join(", ");
    throw new Error(`Version ${version} is not tracked (available: ${available})`);
  }
  return { version, revision: config.revision, aliases: entry.aliases };
};

export const tagNames = (config: FeatureConfig, version: string, channel: string): string[] =>
  baseTagNames(sourceOf(config, version), channel);

export const canonicalTag = (config: FeatureConfig, version: string, channel: string): string =>
  baseCanonicalTag(sourceOf(config, version), channel);

export const imageRef = (prefix: string, tag: string): string => `${prefix}/ripgrep:${tag}`;

export const imageRefs = (prefix: string, tags: readonly string[]): string[] =>
  tags.map((tag) => imageRef(prefix, tag));
