import type { TagSource } from "@/scripts/tasks/features/tags.js";
import { canonicalTag as baseCanonicalTag, tagNames as baseTagNames } from "@/scripts/tasks/features/tags.js";

import type { Component, FeatureConfig } from "./generateConfig.js";

const sourceOf = (config: FeatureConfig, component: Component, version: string): TagSource => {
  const entry = config.components[component].versions[version];
  if (entry === undefined) {
    const available = Object.keys(config.components[component].versions).join(", ");
    throw new Error(`Component ${component} has no version ${version} (available: ${available})`);
  }
  return { version, revision: config.revision, aliases: entry.aliases };
};

export const tagNames = (config: FeatureConfig, component: Component, version: string, channel: string): string[] =>
  baseTagNames(sourceOf(config, component, version), channel);

export const canonicalTag = (config: FeatureConfig, component: Component, version: string, channel: string): string =>
  baseCanonicalTag(sourceOf(config, component, version), channel);

export const imageRef = (prefix: string, component: Component, tag: string): string =>
  `${prefix}/dotnet/${component}:${tag}`;

export const imageRefs = (prefix: string, component: Component, tags: readonly string[]): string[] =>
  tags.map((tag) => imageRef(prefix, component, tag));
