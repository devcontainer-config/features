import type { TagSet, TagSource } from "@/scripts/tasks/features/tags.js";
import { tagNames as baseTagNames } from "@/scripts/tasks/features/tags.js";

import type { Component, FeatureConfig } from "./generateConfig.js";

const repositories: Record<Component, string> = { uv: "uv", python: "uv/python" };

const sourceOf = (config: FeatureConfig, component: Component, key: string): TagSource => {
  const entry = config.components[component].versions[key];
  if (entry === undefined) {
    const available = Object.keys(config.components[component].versions).join(", ");
    throw new Error(`Component ${component} has no version ${key} (available: ${available})`);
  }
  return { key, revision: config.revision, aliases: config.components[component].aliases[key] };
};

export const tagNames = (config: FeatureConfig, component: Component, key: string, channel: string): TagSet =>
  baseTagNames(sourceOf(config, component, key), channel);

export const imageRef = (prefix: string, component: Component, tag: string): string =>
  `${prefix}/${repositories[component]}:${tag}`;

export const imageRefs = (prefix: string, component: Component, tags: readonly string[]): string[] =>
  tags.map((tag) => imageRef(prefix, component, tag));
