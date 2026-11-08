import type { DockerArch } from "../architecture.js";
import { isDirectory, ridFor } from "../architecture.js";
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
  const cache = payloadPath("code-server", "code-server", section.key, arch);
  const archive = section.entry[ridFor(arch)];
  return {
    cache,
    tarball: { cache, url: archive.url, sha256: archive.sha256 },
  };
};

export const payloadPresent = (payload: Payload): Promise<boolean> => isDirectory(payload.cache);

export const ensurePayload = async (section: PayloadSection, arch: DockerArch, force: boolean): Promise<void> => {
  const payload = derive(section, arch);
  if (!force && (await payloadPresent(payload))) {
    console.log(`Payload already present at ${payload.cache}; skipping fetch`);
    return;
  }
  await stageTarball(payload.tarball);
};
