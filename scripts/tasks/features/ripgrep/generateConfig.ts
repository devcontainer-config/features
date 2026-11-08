import path from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import { checkTagNamespace, configFile } from "@/scripts/tasks/features/config.js";

import type { TrackedRelease, Version } from "../githubReleases.js";
import { artifactOf, trackedRelease, versionAliases } from "../githubReleases.js";

export const configPath = path.resolve(projectRoot, "features/ripgrep/config.json");

export const targets = ["x86_64-unknown-linux-musl", "aarch64-unknown-linux-musl"] as const;
export type Target = (typeof targets)[number];

const minimumVersion: Version = [15, 2, 0];

const artifactSchema = z.object({ url: z.string(), sha256: z.string() });

const versionEntrySchema = z.strictObject({
  "x86_64-unknown-linux-musl": artifactSchema,
  "aarch64-unknown-linux-musl": artifactSchema,
});

const aliasTableSchema = z.record(z.string(), z.array(z.string()));

export const featureConfigSchema = z.strictObject({
  revision: z.int().min(1),
  versions: z.record(z.string(), versionEntrySchema),
  aliases: aliasTableSchema,
});

export type VersionEntry = z.infer<typeof versionEntrySchema>;
export type FeatureConfig = z.infer<typeof featureConfigSchema>;

const validateConfig = (config: FeatureConfig, source: string): void => {
  checkTagNamespace({
    source,
    revision: config.revision,
    versions: config.versions,
    aliases: config.aliases,
    requiredClaims: ["latest"],
  });
};

const config = configFile({ path: configPath, schema: featureConfigSchema, validate: validateConfig });

export const parseConfig = config.parse;
export const readConfig = config.read;

const versionEntry = (release: TrackedRelease): VersionEntry => ({
  "x86_64-unknown-linux-musl": artifactOf(release, `ripgrep-${release.version}-x86_64-unknown-linux-musl.tar.gz`),
  "aarch64-unknown-linux-musl": artifactOf(release, `ripgrep-${release.version}-aarch64-unknown-linux-musl.tar.gz`),
});

export const generateConfig = async (): Promise<void> => {
  const release = await trackedRelease("BurntSushi/ripgrep", minimumVersion);
  const document: FeatureConfig = {
    revision: await config.revision(),
    versions: { [release.version]: versionEntry(release) },
    aliases: { [release.version]: versionAliases(release) },
  };
  await config.write(document);
};
