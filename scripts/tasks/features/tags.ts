import { getRemoteInfo } from "@/scripts/git.js";

export const mainChannel = "main";

export interface TagSource {
  version: string;
  revision: number;
  aliases: readonly string[];
}

const tagPattern = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/;

const channelSuffix = (channel: string): string => {
  const suffix = channel.replaceAll(/[^a-zA-Z0-9._-]/gu, "-").replaceAll(/^[-.]+|[-.]+$/gu, "");
  if (suffix === "") {
    throw new Error(`Channel ${channel} has an empty tag suffix`);
  }
  return suffix;
};

const mainTagNames = (source: TagSource): readonly string[] => [
  `${source.version}-r${source.revision}`,
  source.version,
  ...source.aliases,
];

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

export const tagNames = (source: TagSource, channel: string): string[] => {
  const names = channelTagNames(mainTagNames(source), channel);
  return names.map((tag) => {
    if (!tagPattern.test(tag)) {
      throw new Error(`Channel ${channel}: derived tag ${tag} is not a valid registry tag`);
    }
    return tag;
  });
};

export const canonicalTag = (source: TagSource, channel: string): string => {
  const [canonical] = tagNames(source, channel);
  return canonical;
};

export const defaultRefPrefix = async (): Promise<string> => {
  const { owner, repo } = await getRemoteInfo();
  return `ghcr.io/${owner}/${repo}`;
};
