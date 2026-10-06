import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import * as prettier from "prettier";
import { z } from "zod";

import prettierOptions from "@/.config/prettier/.prettierrc.json" with { type: "json" };
import { projectRoot } from "@/scripts/project.js";

const releasesUrl = "https://api.github.com/repos/BurntSushi/ripgrep/releases";
export const configPath = path.resolve(projectRoot, "features/ripgrep/config.json");

export const targets = ["x86_64-unknown-linux-musl", "aarch64-unknown-linux-musl"] as const;
export type Target = (typeof targets)[number];

type Version = readonly [number, number, number];

const minimumVersion: Version = [15, 2, 0];

const releaseSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(
    z.object({
      name: z.string(),
      browser_download_url: z.string(),
      digest: z.string().nullish(),
    }),
  ),
});

const releasesPageSchema = z.array(releaseSchema);

const artifactSchema = z.object({ url: z.string(), sha256: z.string() });

const versionEntrySchema = z.object({
  aliases: z.array(z.string()),
  "x86_64-unknown-linux-musl": artifactSchema,
  "aarch64-unknown-linux-musl": artifactSchema,
});

export const featureConfigSchema = z.object({
  revision: z.number(),
  versions: z.record(z.string(), versionEntrySchema),
});

export type Release = z.infer<typeof releaseSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type VersionEntry = z.infer<typeof versionEntrySchema>;
export type FeatureConfig = z.infer<typeof featureConfigSchema>;

interface Candidate {
  tag: string;
  number: Version;
  release: Release;
}

const versionOf = (tag: string): Version | undefined => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
  if (match === null) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const compare = (left: Version, right: Version): number => {
  for (const [index, part] of left.entries()) {
    if (part !== right[index]) {
      return part - right[index];
    }
  }
  return 0;
};

const fetchReleases = async (): Promise<Release[]> => {
  const releases: Release[] = [];
  for (let page = 1; ; page++) {
    const url = `${releasesUrl}?per_page=100&page=${page}`;
    const response = await fetch(url, { headers: { accept: "application/vnd.github+json" } });
    if (!response.ok) {
      throw new Error(`GET ${url} → HTTP ${response.status}`);
    }
    const result = releasesPageSchema.safeParse(await response.json());
    if (!result.success) {
      throw new Error(`GET ${url}: ${z.prettifyError(result.error)}`);
    }
    if (result.data.length === 0) {
      return releases;
    }
    releases.push(...result.data);
  }
};

const trackedRelease = async (): Promise<Candidate> => {
  const releases = await fetchReleases();
  const candidates = releases.flatMap((release) => {
    if (release.draft || release.prerelease) {
      return [];
    }
    const number = versionOf(release.tag_name);
    if (number === undefined || compare(number, minimumVersion) < 0) {
      return [];
    }
    return [{ tag: release.tag_name, number, release }];
  });
  if (candidates.length === 0) {
    throw new Error(`No stable release at or above ${minimumVersion.join(".")}`);
  }
  return candidates.reduce((best, candidate) => (compare(candidate.number, best.number) > 0 ? candidate : best));
};

const resolveArtifact = (candidate: Candidate, target: Target): Artifact => {
  const name = `ripgrep-${candidate.tag}-${target}.tar.gz`;
  const matches = candidate.release.assets.filter((asset) => asset.name === name);
  if (matches.length !== 1) {
    throw new Error(`Release ${candidate.tag}: expected one asset ${name}, found ${matches.length}`);
  }
  const [asset] = matches;
  const match = /^sha256:([0-9a-f]{64})$/.exec(asset.digest ?? "");
  if (match === null) {
    throw new Error(`Release ${candidate.tag}: asset ${name} has no sha256 digest (${asset.digest ?? "none"})`);
  }
  return { url: asset.browser_download_url, sha256: match[1] };
};

const versionEntry = (candidate: Candidate): VersionEntry => {
  const [major, minor] = candidate.number;
  return {
    aliases: [`${major}.${minor}`, `${major}`, "latest"],
    "x86_64-unknown-linux-musl": resolveArtifact(candidate, "x86_64-unknown-linux-musl"),
    "aarch64-unknown-linux-musl": resolveArtifact(candidate, "aarch64-unknown-linux-musl"),
  };
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
  const candidate = await trackedRelease();
  const config: FeatureConfig = {
    revision: await readRevision(),
    versions: { [candidate.tag]: versionEntry(candidate) },
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
