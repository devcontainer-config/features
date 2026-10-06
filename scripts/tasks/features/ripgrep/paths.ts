import { stat } from "node:fs/promises";
import path from "node:path";

import { workspaces } from "@/scripts/project.js";

import type { Target } from "./generateConfig.js";

const dockerArchOptions = ["amd64", "arm64"] as const;
export type DockerArch = (typeof dockerArchOptions)[number];

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

const targets: Record<DockerArch, Target> = {
  amd64: "x86_64-unknown-linux-musl",
  arm64: "aarch64-unknown-linux-musl",
};

const payloadRoot = path.resolve(workspaces, "payload/ripgrep");

const payloadPath = (version: string, arch: DockerArch): string => path.join(payloadRoot, version, arch);

const contextPath = (version: string): string => path.join(payloadRoot, "ctx", version);

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
  targets,
  payloadRoot,
  payloadPath,
  contextPath,
  isFile,
} as const;
