import path from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import { checkTagNamespace, configFile } from "@/scripts/tasks/features/config.js";

import type { TrackedRelease } from "../githubReleases.js";
import { artifactOf, trackedRelease, versionAliases } from "../githubReleases.js";

export const configPath = path.resolve(projectRoot, "features/code-server/config.json");

const artifactSchema = z.object({ url: z.string(), sha256: z.string() });

const versionEntrySchema = z.strictObject({
  "linux-x64": artifactSchema,
  "linux-arm64": artifactSchema,
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
  "linux-x64": artifactOf(release, `code-server-${release.version}-linux-amd64.tar.gz`),
  "linux-arm64": artifactOf(release, `code-server-${release.version}-linux-arm64.tar.gz`),
});

export const generateConfig = async (): Promise<void> => {
  const release = await trackedRelease("coder/code-server");
  const document: FeatureConfig = {
    revision: await config.revision(),
    versions: { [release.version]: versionEntry(release) },
    aliases: { [release.version]: versionAliases(release) },
  };
  await config.write(document);
};
