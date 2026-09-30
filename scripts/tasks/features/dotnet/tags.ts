import { getRemoteInfo } from "@/scripts/git.js";

import type { Component, FeatureConfig } from "./generateConfig.js";

export const mainChannel = "main";

const tagPattern = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/;

const channelSuffix = (channel: string): string => {
  const suffix = channel.replaceAll(/[^a-zA-Z0-9._-]/gu, "-").replaceAll(/^[-.]+|[-.]+$/gu, "");
  if (suffix === "") {
    throw new Error(`Channel ${channel} has an empty tag suffix`);
  }
  return suffix;
};

const mainTagNames = (config: FeatureConfig, component: Component, version: string): readonly string[] => {
  const entry = config.components[component].versions[version];
  if (entry === undefined) {
    const available = Object.keys(config.components[component].versions).join(", ");
    throw new Error(`Component ${component} has no version ${version} (available: ${available})`);
  }
  return [`${version}-r${config.revision}`, version, ...entry.aliases];
};

const channelTagNames = (names: readonly string[], channel: string): readonly string[] => {
  if (channel === mainChannel) {
    return names;
  }
  const suffix = channelSuffix(channel);
  const mainTags = new Set(names);
  return names.map((name) => {
    const tag = `${name}-${suffix}`;
    if (mainTags.has(tag)) {
      throw new Error(`Channel ${channel}: derived tag ${tag} is one of the pair's main channel tags`);
    }
    return tag;
  });
};

export const tagNames = (config: FeatureConfig, component: Component, version: string, channel: string): string[] => {
  const names = channelTagNames(mainTagNames(config, component, version), channel);
  return names.map((tag) => {
    if (!tagPattern.test(tag)) {
      throw new Error(`Channel ${channel}: derived tag ${tag} is not a valid registry tag`);
    }
    return tag;
  });
};

export const canonicalTag = (config: FeatureConfig, component: Component, version: string, channel: string): string => {
  const [canonical] = tagNames(config, component, version, channel);
  return canonical;
};

export const defaultRefPrefix = async (): Promise<string> => {
  const { owner, repo } = await getRemoteInfo();
  return `ghcr.io/${owner}/${repo}`;
};

export const imageRef = (prefix: string, component: Component, tag: string): string =>
  `${prefix}/dotnet/${component}:${tag}`;

export const imageRefs = (prefix: string, component: Component, tags: readonly string[]): string[] =>
  tags.map((tag) => imageRef(prefix, component, tag));
