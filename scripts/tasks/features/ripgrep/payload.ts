import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";
import { download } from "@/scripts/tasks/features/download.js";

import { configPath, readConfig } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

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

export const ensurePayload = async (version: string, arch: DockerArch, force: boolean): Promise<void> => {
  const outPath = paths.payloadPath(version, arch);
  if (!force && (await paths.isFile(path.join(outPath, "rg")))) {
    console.log(`Payload already present at ${outPath}; skipping fetch`);
    return;
  }
  const config = await readConfig();
  const versionEntry = config.versions[version];
  if (versionEntry === undefined) {
    throw new Error(`Version ${version} is not in ${configPath}`);
  }
  const target = paths.targets[arch];
  const { url, sha256 } = versionEntry[target];
  const tempPath = `${outPath}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const archivePath = path.join(tempPath, "archive.tar.gz");
  const extractedPath = path.join(tempPath, "extracted");
  await mkdir(extractedPath, { recursive: true });
  const actual = await download(url, archivePath);
  if (actual !== sha256) {
    throw new Error(`${url}: sha256 ${actual} does not match the configured ${sha256}`);
  }
  const top = `ripgrep-${version}-${target}`;
  await $$`tar ${[
    "-xzf",
    archivePath,
    "-C",
    extractedPath,
    "--strip-components=1",
    ...entries.map((entry) => `${top}/${entry}`),
  ]}`;
  for (const entry of entries) {
    if (!(await paths.isFile(path.join(extractedPath, entry)))) {
      throw new Error(`${url}: the archive has no ${entry}`);
    }
  }
  await rm(outPath, { recursive: true, force: true });
  await rename(extractedPath, outPath);
  await rm(tempPath, { recursive: true, force: true });
  console.log(`Payload written to ${outPath}`);
};
