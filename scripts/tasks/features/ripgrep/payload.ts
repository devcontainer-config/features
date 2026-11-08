import path from "node:path";

import type { DockerArch } from "../architecture.js";
import { isFile } from "../architecture.js";
import { payloadPath } from "../paths.js";
import type { Tarball } from "../tarball.js";
import { stageTarball } from "../tarball.js";
import type { FeatureConfig, Target, VersionEntry } from "./generateConfig.js";
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
  const target = targets[arch];
  const cache = payloadPath("ripgrep", "ripgrep", section.key, arch);
  const archive = section.entry[target];
  return {
    cache,
    present: path.join(cache, "rg"),
    tarball: {
      cache,
      url: archive.url,
      sha256: archive.sha256,
      extract: { top: `ripgrep-${section.key}-${target}`, entries },
    },
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
