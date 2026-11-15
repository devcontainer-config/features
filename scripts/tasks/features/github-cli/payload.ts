import path from "node:path";

import type { DockerArch } from "../architecture.js";
import { isFile, ridFor } from "../architecture.js";
import { payloadPath } from "../paths.js";
import type { Tarball } from "../tarball.js";
import { stageTarball } from "../tarball.js";
import type { FeatureConfig, VersionEntry } from "./generateConfig.js";
import { configPath, readConfig } from "./generateConfig.js";

export interface PayloadSection {
  key: string;
  entry: VersionEntry;
}

export interface Payload {
  cache: string;
  present: string;
  tarball: Tarball;
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
  const cache = payloadPath("github-cli", "github-cli", section.key, arch);
  const artifact = section.entry[ridFor(arch)];
  return {
    cache,
    present: path.join(cache, "bin/gh"),
    tarball: { cache, url: artifact.url, sha256: artifact.sha256 },
  };
};

export const payloadPresent = (payload: Payload): Promise<boolean> => isFile(payload.present);

export const ensurePayload = async (section: PayloadSection, arch: DockerArch, force: boolean): Promise<void> => {
  const payload = derive(section, arch);
  if (!force && (await payloadPresent(payload))) {
    console.log(`Payload already present at ${payload.cache}; skipping fetch`);
    return;
  }
  await stageTarball(payload.tarball);
};
