import { stat } from "node:fs/promises";

export const dockerArchOptions = ["amd64", "arm64"] as const;
export type DockerArch = (typeof dockerArchOptions)[number];

export const rids = ["linux-x64", "linux-arm64"] as const;
export type Rid = (typeof rids)[number];

export const hostArch = (): DockerArch => {
  switch (process.arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unsupported host architecture: ${process.arch}`);
  }
};

const ridByArch: Record<DockerArch, Rid> = { amd64: "linux-x64", arm64: "linux-arm64" };

export const ridFor = (arch: DockerArch): Rid => ridByArch[arch];

export const isFile = async (candidate: string): Promise<boolean> => {
  try {
    return (await stat(candidate)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

export const isDirectory = async (candidate: string): Promise<boolean> => {
  try {
    return (await stat(candidate)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
};
