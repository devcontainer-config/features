import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";

import { isFile } from "./architecture.js";
import { download } from "./download.js";

export interface Tarball {
  /** The payload directory the extracted archive replaces in one rename. */
  cache: string;
  url: string;
  sha256: string;
  /** The members to extract, under the archive's single top directory; every member when absent. */
  extract?: { top: string; entries: readonly string[] };
}

/** Fetches and extracts `tarball`; its cache is replaced only once the archive has passed every check. */
export const stageTarball = async (tarball: Tarball): Promise<void> => {
  const tempPath = `${tarball.cache}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const archivePath = path.join(tempPath, "archive.tar.gz");
  const extractedPath = path.join(tempPath, "extracted");
  await mkdir(extractedPath, { recursive: true });
  const actual = await download(tarball.url, archivePath);
  if (actual !== tarball.sha256) {
    throw new Error(`${tarball.url}: sha256 ${actual} does not match the configured ${tarball.sha256}`);
  }
  const extract = tarball.extract;
  const members = extract === undefined ? [] : extract.entries.map((entry) => `${extract.top}/${entry}`);
  await $$`tar ${["-xzf", archivePath, "-C", extractedPath, "--strip-components=1", ...members]}`;
  for (const entry of extract?.entries ?? []) {
    if (!(await isFile(path.join(extractedPath, entry)))) {
      throw new Error(`${tarball.url}: the archive has no ${entry}`);
    }
  }
  await rm(tarball.cache, { recursive: true, force: true });
  await rename(extractedPath, tarball.cache);
  await rm(tempPath, { recursive: true, force: true });
  console.log(`Payload written to ${tarball.cache}`);
};
