import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";
import { download } from "@/scripts/tasks/features/download.js";

import type { Artifact, Component, FeatureConfig, PythonVersion, UvVersion } from "./generateConfig.js";
import { configPath, readConfig } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

const pythonUrlPrefix = "https://github.com/astral-sh/python-build-standalone/releases/download/";
const uvBinaries = ["uv", "uvx"] as const;
const pythonVersionPattern = /^(\d+)\.(\d+)\.(\d+)$/u;

export interface UvSection {
  component: "uv";
  key: string;
  entry: UvVersion;
}

export interface PythonSection {
  component: "python";
  key: string;
  entry: PythonVersion;
}

export type PayloadSection = UvSection | PythonSection;

export interface Sections {
  uv: UvSection;
  python: PythonSection;
}

export interface UvPayload {
  component: "uv";
  key: string;
  cache: string;
  present: string;
  triple: string;
  archive: Artifact;
}

export interface PythonArchive {
  build: string;
  name: string;
  url: string;
  sha256: string;
}

export interface PythonDownloadEntry {
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

export interface PythonPayload {
  component: "python";
  key: string;
  pythonVersion: string;
  build: string;
  cache: string;
  present: string;
  archive: PythonArchive;
  archivePath: string;
  entryKey: string;
  entryPath: string;
  entry: PythonDownloadEntry;
}

export type Payload = UvPayload | PythonPayload;

const sectionOfUntyped = (config: FeatureConfig, component: Component, key: string): PayloadSection => {
  if (component === "uv") {
    const entry = config.components.uv.versions[key];
    if (entry === undefined) {
      throw new Error(`${component} version ${key} is not in ${configPath}`);
    }
    return { component, key, entry };
  }
  const entry = config.components.python.versions[key];
  if (entry === undefined) {
    throw new Error(`${component} version ${key} is not in ${configPath}`);
  }
  return { component, key, entry };
};

export const sectionOf = <ComponentT extends Component>(
  config: FeatureConfig,
  component: ComponentT,
  key: string,
): Sections[ComponentT] => sectionOfUntyped(config, component, key) as Sections[ComponentT];

export const loadSection = async <ComponentT extends Component>(
  component: ComponentT,
  key: string,
): Promise<Sections[ComponentT]> => sectionOf(await readConfig(), component, key);

const pythonArchive = (section: PythonSection, arch: DockerArch): PythonArchive => {
  const { url, sha256 } = section.entry[paths.ridFor(arch)];
  if (!url.startsWith(pythonUrlPrefix)) {
    throw new Error(`${url}: a python archive url must start with ${pythonUrlPrefix}`);
  }
  const [build, encodedName, ...rest] = url.slice(pythonUrlPrefix.length).split("/");
  if (build === undefined || encodedName === undefined || rest.length > 0) {
    throw new Error(`${url}: a python archive url must be <release>/<build>/<file name>`);
  }
  if (build !== section.entry.build) {
    throw new Error(`${url}: the url build ${build} does not match the configured ${section.entry.build}`);
  }
  return { build, name: decodeURIComponent(encodedName), url, sha256 };
};

const pythonEntry = (
  section: PythonSection,
  arch: DockerArch,
  archive: PythonArchive,
): { key: string; entry: PythonDownloadEntry } => {
  const match = pythonVersionPattern.exec(section.entry.pythonVersion);
  if (match === null) {
    throw new Error(`Version ${section.key} is not <major>.<minor>.<patch>`);
  }
  const [, major, minor, patch] = match;
  const machine = paths.machineOf(arch);
  const key = `cpython-${section.entry.pythonVersion}-linux-${machine}-gnu`;
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

export const derive = (section: PayloadSection, arch: DockerArch): Payload => {
  const cache = paths.payloadPath(section.component, section.key, arch);
  if (section.component === "uv") {
    return {
      component: "uv",
      key: section.key,
      cache,
      present: path.join(cache, "uv"),
      triple: paths.muslTriples[arch],
      archive: section.entry[paths.ridFor(arch)],
    };
  }
  const archive = pythonArchive(section, arch);
  const { key: entryKey, entry } = pythonEntry(section, arch, archive);
  const archivePath = path.join(cache, archive.build, archive.name);
  return {
    component: "python",
    key: section.key,
    pythonVersion: section.entry.pythonVersion,
    build: archive.build,
    cache,
    present: archivePath,
    archive,
    archivePath,
    entryKey,
    entryPath: path.join(cache, "entries", `${entryKey}.json`),
    entry,
  };
};

export const payloadPresent = (payload: Payload): Promise<boolean> => paths.isFile(payload.present);

export interface PythonPayloadPaths {
  archive: string;
  entry: string;
  build: string;
  name: string;
}

export const pythonPayloadPaths = (section: PythonSection, arch: DockerArch): PythonPayloadPaths => {
  const payload = derive(section, arch);
  if (payload.component !== "python") {
    throw new Error(`Version ${section.key} is not a python payload`);
  }
  return {
    archive: payload.archivePath,
    entry: payload.entryPath,
    build: payload.build,
    name: payload.archive.name,
  };
};

const fetchUvPayload = async (payload: UvPayload): Promise<void> => {
  const tempPath = `${payload.cache}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const archivePath = path.join(tempPath, "archive.tar.gz");
  const extractedPath = path.join(tempPath, "extracted");
  await mkdir(extractedPath, { recursive: true });
  const actual = await download(payload.archive.url, archivePath);
  if (actual !== payload.archive.sha256) {
    throw new Error(`${payload.archive.url}: sha256 ${actual} does not match the configured ${payload.archive.sha256}`);
  }
  const top = `uv-${payload.triple}`;
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
      throw new Error(`${payload.archive.url}: the archive has no ${binary}`);
    }
  }
  await rm(payload.cache, { recursive: true, force: true });
  await rename(extractedPath, payload.cache);
  await rm(tempPath, { recursive: true, force: true });
  console.log(`Payload written to ${payload.cache}`);
};

const fetchPythonPayload = async (payload: PythonPayload): Promise<void> => {
  const tempPath = `${payload.cache}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  const downloadPath = path.join(tempPath, payload.build, payload.archive.name);
  await mkdir(path.dirname(downloadPath), { recursive: true });
  const actual = await download(payload.archive.url, downloadPath);
  if (actual !== payload.archive.sha256) {
    throw new Error(`${payload.archive.url}: sha256 ${actual} does not match the configured ${payload.archive.sha256}`);
  }
  const entryPath = path.join(tempPath, "entries", `${payload.entryKey}.json`);
  await mkdir(path.dirname(entryPath), { recursive: true });
  await writeFile(entryPath, `${JSON.stringify({ [payload.entryKey]: payload.entry }, null, 2)}\n`);
  await rm(payload.cache, { recursive: true, force: true });
  await rename(tempPath, payload.cache);
  console.log(`Payload written to ${payload.cache}`);
};

export const ensurePayload = async (section: PayloadSection, arch: DockerArch, force: boolean): Promise<void> => {
  const payload = derive(section, arch);
  if (!force && (await payloadPresent(payload))) {
    console.log(`Payload already present at ${payload.cache}; skipping fetch`);
    return;
  }
  if (payload.component === "uv") {
    await fetchUvPayload(payload);
  } else {
    await fetchPythonPayload(payload);
  }
};
