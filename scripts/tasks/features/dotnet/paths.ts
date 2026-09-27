import { stat } from "node:fs/promises";
import path from "node:path";

import { workspaces } from "@/scripts/project.js";

import type { Component, Rid } from "./generateConfig.js";

const dockerArchOptions = ["amd64", "arm64"] as const;
export type DockerArch = (typeof dockerArchOptions)[number];

export type Assembly = "build" | "install";

const hostArch = (): DockerArch => {
  switch (process.arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unsupported host architecture: ${process.arch}`);
  }
};

const rids: Record<DockerArch, Rid> = { amd64: "linux-x64", arm64: "linux-arm64" };

const ridFor = (arch: DockerArch): Rid => rids[arch];

const payloadRoot = path.resolve(workspaces, "payload/dotnet");

const payloadPath = (component: Component, version: string, arch: DockerArch): string =>
  path.join(payloadRoot, component, version, arch);

const contextPath = (component: Component, version: string): string =>
  path.join(payloadRoot, "ctx", component, version);

const packPath = (assembly: Assembly, rid: Rid): string => path.join(workspaces, "bin/dotnet", assembly, rid);

const isFile = async (candidate: string): Promise<boolean> => {
  try {
    return (await stat(candidate)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

export const paths = {
  dockerArchOptions,
  hostArch,
  ridFor,
  payloadRoot,
  payloadPath,
  contextPath,
  packPath,
  isFile,
} as const;
