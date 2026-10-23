import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";
import { download } from "@/scripts/tasks/features/download.js";

import type { Component, PythonVersion, UvVersion } from "./generateConfig.js";
import { configPath, readConfig } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

const pythonUrlPrefix = "https://github.com/astral-sh/python-build-standalone/releases/download/";
const uvBinaries = ["uv", "uvx"] as const;

interface PythonArchive {
  build: string;
  name: string;
  url: string;
  sha256: string;
}

interface PythonDownloadEntry {
  name: string;
  arch: { family: string; variant: null };
  os: string;
  libc: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  url: string;
  sha256: string;
  variant: null;
  build: string;
}

const versionPin = <Entry>(versions: Record<string, Entry>, version: string): Entry => {
  const entry = versions[version];
  if (entry === undefined) {
    throw new Error(`Version ${version} is not in ${configPath}`);
  }
  return entry;
};

const pythonArchive = (pin: PythonVersion, arch: DockerArch): PythonArchive => {
  const { url, sha256 } = pin[paths.ridFor(arch)];
  if (!url.startsWith(pythonUrlPrefix)) {
    throw new Error(`${url}: a python archive url must start with ${pythonUrlPrefix}`);
  }
  const [build, encodedName, ...rest] = url.slice(pythonUrlPrefix.length).split("/");
  if (build === undefined || encodedName === undefined || rest.length > 0) {
    throw new Error(`${url}: a python archive url must be <release>/<build>/<file name>`);
  }
  if (build !== pin.build) {
    throw new Error(`${url}: the url build ${build} does not match the configured ${pin.build}`);
  }
  return { build, name: decodeURIComponent(encodedName), url, sha256 };
};

const pythonEntry = (
  version: string,
  arch: DockerArch,
  archive: PythonArchive,
): { key: string; entry: PythonDownloadEntry } => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (match === null) {
    throw new Error(`Version ${version} is not <major>.<minor>.<patch>`);
  }
  const [, major, minor, patch] = match;
  const machine = paths.machineOf(arch);
  const key = `cpython-${version}-linux-${machine}-gnu`;
  const entry: PythonDownloadEntry = {
    name: "cpython",
    arch: { family: machine, variant: null },
    os: "linux",
    libc: "gnu",
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: "",
    url: archive.url,
    sha256: archive.sha256,
    variant: null,
    build: archive.build,
  };
  return { key, entry };
};

const uvPayloadPresent = (version: string, arch: DockerArch): Promise<boolean> =>
  paths.isFile(path.join(paths.payloadPath("uv", version, arch), "uv"));

const pythonArchivePath = (version: string, arch: DockerArch, archive: PythonArchive): string =>
  path.join(paths.payloadPath("python", version, arch), archive.build, archive.name);

export interface PythonPayloadPaths {
  archive: string;
  entry: string;
  build: string;
  name: string;
}

export const pythonPayloadPaths = async (version: string, arch: DockerArch): Promise<PythonPayloadPaths> => {
  const config = await readConfig();
  const pin = versionPin(config.components.python.versions, version);
  const archive = pythonArchive(pin, arch);
  const { key } = pythonEntry(version, arch, archive);
  return {
    archive: pythonArchivePath(version, arch, archive),
    entry: path.join(paths.payloadPath("python", version, arch), "entries", `${key}.json`),
    build: archive.build,
    name: archive.name,
  };
};

export const payloadPresent = async (component: Component, version: string, arch: DockerArch): Promise<boolean> => {
  const config = await readConfig();
  if (component === "uv") {
    versionPin(config.components.uv.versions, version);
    return uvPayloadPresent(version, arch);
  }
  const pin = versionPin(config.components.python.versions, version);
  return paths.isFile(pythonArchivePath(version, arch, pythonArchive(pin, arch)));
};

const ensureUvPayload = async (version: string, arch: DockerArch, pin: UvVersion, force: boolean): Promise<void> => {
  const outPath = paths.payloadPath("uv", version, arch);
  if (!force && (await uvPayloadPresent(version, arch))) {
    console.log(`Payload already present at ${outPath}; skipping fetch`);
    return;
  }
  const tempPath = `${outPath}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const archivePath = path.join(tempPath, "archive.tar.gz");
  const extractedPath = path.join(tempPath, "extracted");
  await mkdir(extractedPath, { recursive: true });
  const { url, sha256 } = pin[paths.ridFor(arch)];
  const actual = await download(url, archivePath);
  if (actual !== sha256) {
    throw new Error(`${url}: sha256 ${actual} does not match the configured ${sha256}`);
  }
  const top = `uv-${paths.muslTriples[arch]}`;
  await $$`tar ${[
    "-xzf",
    archivePath,
    "-C",
    extractedPath,
    "--strip-components=1",
    ...uvBinaries.map((binary) => `${top}/${binary}`),
  ]}`;
  for (const binary of uvBinaries) {
    if (!(await paths.isFile(path.join(extractedPath, binary)))) {
      throw new Error(`${url}: the archive has no ${binary}`);
    }
  }
  await rm(outPath, { recursive: true, force: true });
  await rename(extractedPath, outPath);
  await rm(tempPath, { recursive: true, force: true });
  console.log(`Payload written to ${outPath}`);
};

const ensurePythonPayload = async (
  version: string,
  arch: DockerArch,
  pin: PythonVersion,
  force: boolean,
): Promise<void> => {
  const outPath = paths.payloadPath("python", version, arch);
  const archive = pythonArchive(pin, arch);
  if (!force && (await paths.isFile(pythonArchivePath(version, arch, archive)))) {
    console.log(`Payload already present at ${outPath}; skipping fetch`);
    return;
  }
  const tempPath = `${outPath}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const downloadPath = path.join(tempPath, archive.build, archive.name);
  await mkdir(path.dirname(downloadPath), { recursive: true });
  const actual = await download(archive.url, downloadPath);
  if (actual !== archive.sha256) {
    throw new Error(`${archive.url}: sha256 ${actual} does not match the configured ${archive.sha256}`);
  }
  const { key, entry } = pythonEntry(version, arch, archive);
  const entriesPath = path.join(tempPath, "entries");
  await mkdir(entriesPath, { recursive: true });
  await writeFile(path.join(entriesPath, `${key}.json`), `${JSON.stringify({ [key]: entry }, null, 2)}\n`);
  await rm(outPath, { recursive: true, force: true });
  await rename(tempPath, outPath);
  console.log(`Payload written to ${outPath}`);
};

export const ensurePayload = async (
  component: Component,
  version: string,
  arch: DockerArch,
  force: boolean,
): Promise<void> => {
  const config = await readConfig();
  if (component === "uv") {
    await ensureUvPayload(version, arch, versionPin(config.components.uv.versions, version), force);
  } else {
    await ensurePythonPayload(version, arch, versionPin(config.components.python.versions, version), force);
  }
};
