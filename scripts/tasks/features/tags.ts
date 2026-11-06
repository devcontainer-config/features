import { getRemoteInfo } from "@/scripts/git.js";
import { mainTagNames, tagPattern } from "@/scripts/tasks/features/config.js";

export const mainChannel = "main";

export interface TagSource {
  key: string;
  revision: number;
  aliases: readonly string[];
}

export interface TagSet {
  canonical: string;
  claims: readonly string[];
  all: readonly string[];
}

const channelSuffix = (channel: string): string => {
  const suffix = channel.replaceAll(/[^a-zA-Z0-9._-]/gu, "-").replaceAll(/^[-.]+|[-.]+$/gu, "");
  if (suffix === "") {
    throw new Error(`Channel ${channel} has an empty tag suffix`);
  }
  return suffix;
};

export const deriveChannel = (ref: string, pullRequest: number | undefined): string => {
  if (pullRequest !== undefined) {
    return `pr-${pullRequest}`;
  }
  if (ref === "refs/heads/main") {
    return mainChannel;
  }
  const branch = "refs/heads/";
  if (ref.startsWith(branch)) {
    return `branch-${channelSuffix(ref.slice(branch.length))}`;
  }
  const tag = "refs/tags/";
  if (ref.startsWith(tag)) {
    return `tag-${channelSuffix(ref.slice(tag.length))}`;
  }
  throw new Error(
    `Cannot derive a channel from ref ${ref}: expected refs/heads/<branch>, refs/tags/<tag> or a pull request number`,
  );
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

export const tagNames = (source: TagSource, channel: string): TagSet => {
  const names = channelTagNames(mainTagNames(source.key, source.revision, source.aliases), channel).map((tag) => {
    if (!tagPattern.test(tag)) {
      throw new Error(`Channel ${channel}: derived tag ${tag} is not a valid registry tag`);
    }
    return tag;
  });
  const [canonical, ...claims] = names;
  return { canonical, claims, all: names };
};

export const defaultRefPrefix = async (): Promise<string> => {
  const { owner, repo } = await getRemoteInfo();
  return `ghcr.io/${owner}/${repo}`;
};
