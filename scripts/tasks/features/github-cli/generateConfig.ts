import path from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";
import { checkTagNamespace, configFile } from "@/scripts/tasks/features/config.js";

import type { DockerArch } from "../architecture.js";
import { dockerArchOptions, ridFor } from "../architecture.js";
import type { Attestations } from "../attestations.js";
import { createAttestations } from "../attestations.js";
import type { TrackedRelease } from "../githubReleases.js";
import { artifactOf, trackedRelease, versionAliases } from "../githubReleases.js";

const repository = "cli/cli";
const identity = "https://github.com/cli/cli/.github/workflows/deployment.yml@refs/heads/trunk";

export const configPath = path.resolve(projectRoot, "features/github-cli/config.json");

const artifactSchema = z.strictObject({ url: z.string(), sha256: z.string() });

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

export type Artifact = z.infer<typeof artifactSchema>;
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

const assetName = (version: string, arch: DockerArch): string => `gh_${version}_linux_${arch}.tar.gz`;

const resolveArtifacts = async (attestations: Attestations, release: TrackedRelease): Promise<VersionEntry> => {
  const tag = `v${release.version}`;
  const purl = `pkg:github/${repository}@${tag}`;
  const entries = await Promise.all(
    dockerArchOptions.map(async (arch) => {
      const artifact = artifactOf(release, assetName(release.version, arch));
      await attestations.verify({ repository, sha256: artifact.sha256, url: artifact.url, tag, purl, identity });
      return [ridFor(arch), artifact] as const;
    }),
  );
  return Object.fromEntries(entries) as VersionEntry;
};

export const generateConfig = async (): Promise<void> => {
  await using attestations = await createAttestations();
  const release = await trackedRelease(repository);
  const document: FeatureConfig = {
    revision: await config.revision(),
    versions: { [release.version]: await resolveArtifacts(attestations, release) },
    aliases: { [release.version]: versionAliases(release) },
  };
  await config.write(document);
};
