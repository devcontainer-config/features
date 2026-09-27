import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import * as prettier from "prettier";
import { z } from "zod";

import prettierOptions from "@/.config/prettier/.prettierrc.json" with { type: "json" };
import { projectRoot } from "@/scripts/project.js";

const releasesIndexUrl = "https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json";
export const configPath = path.resolve(projectRoot, "features/dotnet/config.json");

export const components = ["sdk", "runtime", "aspnet"] as const;
export type Component = (typeof components)[number];

export const rids = ["linux-x64", "linux-arm64"] as const;
export type Rid = (typeof rids)[number];

type FeedKey = "sdk" | "runtime" | "aspnetcore-runtime";

const componentFeedKeys: Record<Component, FeedKey> = {
  sdk: "sdk",
  runtime: "runtime",
  aspnet: "aspnetcore-runtime",
};

const componentFilePrefixes: Record<Component, string> = {
  sdk: "dotnet-sdk-",
  runtime: "dotnet-runtime-",
  aspnet: "aspnetcore-runtime-",
};

const channelSchema = z.object({
  "channel-version": z.string(),
  "latest-runtime": z.string(),
  "latest-sdk": z.string(),
  "release-type": z.string(),
  "support-phase": z.enum(["active", "preview", "maintenance", "eol"]),
  "releases.json": z.string(),
});

const releasesIndexSchema = z.object({ "releases-index": z.array(channelSchema) });

const feedFileSchema = z.object({
  name: z.string(),
  rid: z.string(),
  url: z.string(),
  hash: z.string(),
});

const feedComponentSchema = z.object({
  version: z.string(),
  files: z.array(feedFileSchema),
});

const feedReleaseSchema = z.object({
  sdk: feedComponentSchema.optional(),
  runtime: feedComponentSchema.optional(),
  "aspnetcore-runtime": feedComponentSchema.optional(),
});

const feedReleasesSchema = z.object({ releases: z.array(feedReleaseSchema) });

type FeedChannel = z.infer<typeof channelSchema>;
type FeedIndex = z.infer<typeof releasesIndexSchema>;
type FeedFile = z.infer<typeof feedFileSchema>;
type FeedComponent = z.infer<typeof feedComponentSchema>;
type FeedReleases = z.infer<typeof feedReleasesSchema>;

const artifactSchema = z.object({ url: z.string(), sha512: z.string() });

const componentVersionSchema = z.object({
  aliases: z.array(z.string()),
  "linux-x64": artifactSchema,
  "linux-arm64": artifactSchema,
});

const componentConfigSchema = z.object({ versions: z.record(z.string(), componentVersionSchema) });

export const featureConfigSchema = z.object({
  revision: z.number(),
  components: z.record(z.enum(components), componentConfigSchema),
});

export type Artifact = z.infer<typeof artifactSchema>;
export type ComponentVersion = z.infer<typeof componentVersionSchema>;
export type ComponentConfig = z.infer<typeof componentConfigSchema>;
export type FeatureConfig = z.infer<typeof featureConfigSchema>;

interface ChannelData {
  channel: FeedChannel;
  releases: FeedReleases;
}

const fetchJson = async <S extends z.ZodType>(url: string, schema: S): Promise<z.infer<S>> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} → HTTP ${response.status}`);
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    throw new Error(`GET ${url}: ${z.prettifyError(result.error)}`);
  }
  return result.data;
};

const selectChannels = (index: FeedIndex): FeedChannel[] =>
  index["releases-index"].filter((channel) => channel["support-phase"] !== "eol");

const fetchChannelData = async (channels: readonly FeedChannel[]): Promise<ChannelData[]> =>
  Promise.all(
    channels.map(async (channel) => ({
      channel,
      releases: await fetchJson(channel["releases.json"], feedReleasesSchema),
    })),
  );

const resolveComponent = (releases: FeedReleases, feedKey: FeedKey, expectedVersion: string): FeedComponent => {
  const component = releases.releases.find((release) => release[feedKey]?.version === expectedVersion)?.[feedKey];
  if (!component) {
    throw new Error(`No release entry with ${feedKey}.version === ${expectedVersion}`);
  }
  return component;
};

const resolveArtifacts = (component: Component, version: string, files: readonly FeedFile[]): Record<Rid, Artifact> =>
  Object.fromEntries(
    rids.map((rid) => {
      const name = `${componentFilePrefixes[component]}${rid}.tar.gz`;
      const matches = files.filter((candidate) => candidate.rid === rid && candidate.name === name);
      if (matches.length !== 1) {
        throw new Error(
          `Component ${component} version ${version}: expected one file ${name} for rid ${rid}, found ${matches.length}`,
        );
      }
      const [file] = matches;
      return [rid, { url: file.url, sha512: file.hash }] as const;
    }),
  ) as Record<Rid, Artifact>;

const majorVersion = (channel: FeedChannel): string => {
  const major = /^(\d+)\./.exec(channel["channel-version"])?.[1];
  if (major === undefined) {
    throw new Error(`Channel ${channel["channel-version"]}: cannot derive major version`);
  }
  return major;
};

const resolveVersions = (
  component: Component,
  channelData: readonly ChannelData[],
): Record<string, ComponentVersion> => {
  const feedKey = componentFeedKeys[component];
  const latestChannel = channelData.find((entry) => entry.channel["support-phase"] === "active");
  const ltsChannel = channelData.find(
    (entry) => entry.channel["release-type"] === "lts" && entry.channel["support-phase"] === "active",
  );
  const versions: Record<string, ComponentVersion> = {};
  for (const entry of channelData) {
    const { channel } = entry;
    const expected = component === "sdk" ? channel["latest-sdk"] : channel["latest-runtime"];
    const feedComponent = resolveComponent(entry.releases, feedKey, expected);
    const version = feedComponent.version;
    if (version in versions) {
      throw new Error(`Component ${component}: version ${version} resolved from more than one channel`);
    }
    const major = majorVersion(channel);
    let aliases: string[];
    if (channel["support-phase"] === "preview") {
      aliases = ["preview", `${major}-preview`, `${channel["channel-version"]}-preview`];
    } else {
      aliases = [channel["channel-version"], major];
      if (ltsChannel === entry) {
        aliases.push("lts");
      }
      if (latestChannel === entry) {
        aliases.push("latest");
      }
    }
    versions[version] = { aliases, ...resolveArtifacts(component, version, feedComponent.files) };
  }
  return versions;
};

export const parseConfig = (text: string, source: string): FeatureConfig => {
  const result = featureConfigSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error(`${source}: ${z.prettifyError(result.error)}`);
  }
  return result.data;
};

export const readConfig = async (): Promise<FeatureConfig> =>
  parseConfig(await readFile(configPath, "utf-8"), configPath);

const readRevision = async (): Promise<number> => {
  try {
    return (await readConfig()).revision;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 1;
    }
    throw error;
  }
};

export const generateConfig = async (): Promise<void> => {
  const index = await fetchJson(releasesIndexUrl, releasesIndexSchema);
  const channelData = await fetchChannelData(selectChannels(index));
  const config: FeatureConfig = {
    revision: await readRevision(),
    components: {
      sdk: { versions: resolveVersions("sdk", channelData) },
      runtime: { versions: resolveVersions("runtime", channelData) },
      aspnet: { versions: resolveVersions("aspnet", channelData) },
    },
  };
  await writeFile(
    configPath,
    await prettier.format(JSON.stringify(config), { ...prettierOptions, filepath: configPath }),
  );
};

if (import.meta.main) {
  try {
    await generateConfig();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
