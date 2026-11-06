import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";
import { download } from "@/scripts/tasks/features/download.js";

import type { DockerArch } from "../architecture.js";
import { isFile } from "../architecture.js";
import { payloadPath } from "../paths.js";
import type { Artifact, FeatureConfig, Target, VersionEntry } from "./generateConfig.js";
import { configPath, readConfig } from "./generateConfig.js";

const targets: Record<DockerArch, Target> = {
  amd64: "x86_64-unknown-linux-musl",
  arm64: "aarch64-unknown-linux-musl",
};

const entries = [
  "rg",
  "doc/rg.1",
  "complete/rg.bash",
  "complete/_rg",
  "complete/rg.fish",
  "COPYING",
  "LICENSE-MIT",
  "UNLICENSE",
] as const;

export interface PayloadSection {
  key: string;
  entry: VersionEntry;
}

export interface Payload {
  key: string;
  target: string;
  cache: string;
  present: string;
  top: string;
  archive: Artifact;
}

export const sectionOf = (config: FeatureConfig, key: string): PayloadSection => {
  const entry = config.versions[key];
  if (entry === undefined) {
    throw new Error(`Version ${key} is not in ${configPath}`);
  }
  return { key, entry };
};

export const loadSection = async (key: string): Promise<PayloadSection> => sectionOf(await readConfig(), key);

export const derive = (section: PayloadSection, arch: DockerArch): Payload => {
  const target = targets[arch];
  const cache = payloadPath("ripgrep", "ripgrep", section.key, arch);
  return {
    key: section.key,
    target,
    cache,
    present: path.join(cache, "rg"),
    top: `ripgrep-${section.key}-${target}`,
    archive: section.entry[target],
  };
};

export const payloadPresent = (payload: Payload): Promise<boolean> => isFile(payload.present);

export const ensurePayload = async (section: PayloadSection, arch: DockerArch, force: boolean): Promise<void> => {
  const payload = derive(section, arch);
  if (!force && (await payloadPresent(payload))) {
    console.log(`Payload already present at ${payload.cache}; skipping fetch`);
    return;
  }
  const tempPath = `${payload.cache}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const archivePath = path.join(tempPath, "archive.tar.gz");
  const extractedPath = path.join(tempPath, "extracted");
  await mkdir(extractedPath, { recursive: true });
  const actual = await download(payload.archive.url, archivePath);
  if (actual !== payload.archive.sha256) {
    throw new Error(`${payload.archive.url}: sha256 ${actual} does not match the configured ${payload.archive.sha256}`);
  }
  await $$`tar ${[
    "-xzf",
    archivePath,
    "-C",
    extractedPath,
    "--strip-components=1",
    ...entries.map((entry) => `${payload.top}/${entry}`),
  ]}`;
  for (const entry of entries) {
    if (!(await isFile(path.join(extractedPath, entry)))) {
      throw new Error(`${payload.archive.url}: the archive has no ${entry}`);
    }
  }
  await rm(payload.cache, { recursive: true, force: true });
  await rename(extractedPath, payload.cache);
  await rm(tempPath, { recursive: true, force: true });
  console.log(`Payload written to ${payload.cache}`);
};
