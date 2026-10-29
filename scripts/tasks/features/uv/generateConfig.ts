import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import * as prettier from "prettier";
import { z } from "zod";

import prettierOptions from "@/.config/prettier/.prettierrc.json" with { type: "json" };
import { projectRoot } from "@/scripts/project.js";
import { checkTagNamespace } from "@/scripts/tasks/features/config.js";

import { verifyAttestation } from "./attestations.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

const uvIndexUrl = "https://raw.githubusercontent.com/astral-sh/versions/main/v1/uv.ndjson";
const pythonIndexUrl = "https://raw.githubusercontent.com/astral-sh/versions/main/v1/python-build-standalone.ndjson";
const uvSlug = "astral-sh/uv";
const pythonSlug = "astral-sh/python-build-standalone";
const stablePattern = /^\d+\.\d+\.\d+$/u;
const buildPattern = /^\d+$/u;

export const configPath = path.resolve(projectRoot, "features/uv/config.json");

export const components = ["uv", "python"] as const;
export type Component = (typeof components)[number];

export const rids = ["linux-x64", "linux-arm64"] as const;
export type Rid = (typeof rids)[number];

const indexArtifactSchema = z.object({
  platform: z.string(),
  variant: z.string(),
  url: z.string(),
  archive_format: z.string(),
  sha256: z.string(),
});

const indexReleaseSchema = z.object({
  version: z.string(),
  artifacts: z.array(indexArtifactSchema),
});

const artifactSchema = z.strictObject({ url: z.string(), sha256: z.string() });

const uvVersionSchema = z.strictObject({
  "linux-x64": artifactSchema,
  "linux-arm64": artifactSchema,
});

const pythonVersionSchema = z.strictObject({
  pythonVersion: z.string(),
  build: z.string(),
  "linux-x64": artifactSchema,
  "linux-arm64": artifactSchema,
});

const aliasTableSchema = z.record(z.string(), z.array(z.string()));

const uvComponentSchema = z.strictObject({
  versions: z.record(z.string(), uvVersionSchema),
  aliases: aliasTableSchema,
});

const pythonComponentSchema = z.strictObject({
  versions: z.record(z.string(), pythonVersionSchema),
  aliases: aliasTableSchema,
});

export const featureConfigSchema = z.strictObject({
  revision: z.number(),
  components: z.strictObject({
    uv: uvComponentSchema,
    python: pythonComponentSchema,
  }),
});

type IndexArtifact = z.infer<typeof indexArtifactSchema>;
type IndexRelease = z.infer<typeof indexReleaseSchema>;

export type Artifact = z.infer<typeof artifactSchema>;
export type UvVersion = z.infer<typeof uvVersionSchema>;
export type PythonVersion = z.infer<typeof pythonVersionSchema>;
export type FeatureConfig = z.infer<typeof featureConfigSchema>;

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} → HTTP ${response.status}`);
  }
  return response.text();
};

const parseIndex = (text: string, source: string): IndexRelease[] =>
  text
    .split("\n")
    .filter((line) => line !== "")
    .map((line, index) => {
      const result = indexReleaseSchema.safeParse(JSON.parse(line));
      if (!result.success) {
        throw new Error(`${source}:${index + 1}: ${z.prettifyError(result.error)}`);
      }
      return result.data;
    });

const resolveArtifacts = async (
  slug: string,
  version: string,
  artifacts: readonly IndexArtifact[],
  platforms: Record<DockerArch, string>,
  variant: string,
): Promise<Record<Rid, Artifact>> => {
  const resolved = Object.fromEntries(
    paths.dockerArchOptions.map((arch) => {
      const platform = platforms[arch];
      const matches = artifacts.filter(
        (artifact) =>
          artifact.platform === platform && artifact.variant === variant && artifact.archive_format === "tar.gz",
      );
      if (matches.length !== 1) {
        throw new Error(`Release ${version}: expected one ${platform} ${variant} archive, found ${matches.length}`);
      }
      const [artifact] = matches;
      return [paths.ridFor(arch), { url: artifact.url, sha256: artifact.sha256 }] as const;
    }),
  ) as Record<Rid, Artifact>;
  for (const rid of rids) {
    await verifyAttestation(slug, resolved[rid].sha256);
  }
  return resolved;
};

const trackedUvRelease = (releases: readonly IndexRelease[]): IndexRelease => {
  const release = releases.find((candidate) => stablePattern.test(candidate.version));
  if (release === undefined) {
    throw new Error("The uv version index carries no stable release");
  }
  return release;
};

const pythonReleaseParts = (release: IndexRelease): { version: string; build: string } => {
  const [version, build, ...rest] = release.version.split("+");
  if (version === undefined || build === undefined || rest.length > 0 || !buildPattern.test(build)) {
    throw new Error(`Version index entry ${release.version} is not <version>+<build>`);
  }
  return { version, build };
};

const trackedPythonReleases = (releases: readonly IndexRelease[]): { build: string; entries: IndexRelease[] } => {
  const parts = releases.map((release) => pythonReleaseParts(release));
  if (parts.length === 0) {
    throw new Error("The python version index is empty");
  }
  const build = parts.reduce(
    (greatest, part) => (Number(part.build) > Number(greatest) ? part.build : greatest),
    parts[0].build,
  );
  const entries = releases.filter(
    (_release, index) => parts[index].build === build && stablePattern.test(parts[index].version),
  );
  if (entries.length === 0) {
    throw new Error(`The python build ${build} carries no stable version`);
  }
  return { build, entries };
};

const compareVersions = (left: string, right: string): number => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (const [index, part] of leftParts.entries()) {
    if (part !== rightParts[index]) {
      return part - rightParts[index];
    }
  }
  return 0;
};

const pythonVersions = async (releases: readonly IndexRelease[]): Promise<Components["python"]> => {
  const { build, entries } = trackedPythonReleases(releases);
  const resolved = await Promise.all(
    entries.map(async (release) => {
      const { version } = pythonReleaseParts(release);
      const [major, minor] = version.split(".");
      const key = `${version}-${build}`;
      const entry: PythonVersion = {
        pythonVersion: version,
        build,
        ...(await resolveArtifacts(pythonSlug, version, release.artifacts, paths.gnuTriples, "install_only_stripped")),
      };
      return { key, version, aliases: [`${major}.${minor}`, version], entry } as const;
    }),
  );
  resolved.sort((left, right) => compareVersions(left.version, right.version));
  const versions: Record<string, PythonVersion> = {};
  const aliases: Record<string, string[]> = {};
  for (const [index, { key, aliases: row, entry }] of resolved.entries()) {
    versions[key] = entry;
    aliases[key] = index === resolved.length - 1 ? [...row, "latest"] : [...row];
  }
  return { versions, aliases };
};

type Components = FeatureConfig["components"];

const validatePython = (config: FeatureConfig, source: string): void => {
  for (const [key, entry] of Object.entries(config.components.python.versions)) {
    const expected = `${entry.pythonVersion}-${entry.build}`;
    if (key !== expected) {
      throw new Error(`${source}: python version key ${key} is not <pythonVersion>-<build> (${expected})`);
    }
  }
};

const validateConfig = (config: FeatureConfig, source: string): void => {
  for (const component of components) {
    checkTagNamespace({
      source: `${source} component ${component}`,
      revision: config.revision,
      versions: config.components[component].versions,
      aliases: config.components[component].aliases,
      requiredClaims: ["latest"],
    });
  }
  validatePython(config, `${source} component python`);
};

export const parseConfig = (text: string, source: string): FeatureConfig => {
  const result = featureConfigSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error(`${source}: ${z.prettifyError(result.error)}`);
  }
  validateConfig(result.data, source);
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
  const uvRelease = trackedUvRelease(parseIndex(await fetchText(uvIndexUrl), uvIndexUrl));
  const pythonReleases = parseIndex(await fetchText(pythonIndexUrl), pythonIndexUrl);
  const [major, minor] = uvRelease.version.split(".");
  const config: FeatureConfig = {
    revision: await readRevision(),
    components: {
      uv: {
        versions: {
          [uvRelease.version]: await resolveArtifacts(
            uvSlug,
            uvRelease.version,
            uvRelease.artifacts,
            paths.muslTriples,
            "default",
          ),
        },
        aliases: { [uvRelease.version]: [`${major}.${minor}`, "latest"] },
      },
      python: await pythonVersions(pythonReleases),
    },
  };
  validateConfig(config, configPath);
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
