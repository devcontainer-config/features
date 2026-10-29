import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

export interface Invocation {
  key: string;
  arch: DockerArch;
}

export const parseKey = (value: string | undefined): string => {
  if (value === undefined || value === "") {
    throw new Error("--version is required");
  }
  return value;
};

export const parseInvocation = (values: { version?: string; arch?: string }): Invocation => {
  const key = parseKey(values.version);
  const arch =
    values.arch === undefined
      ? paths.hostArch()
      : paths.dockerArchOptions.find((candidate) => candidate === values.arch);
  if (arch === undefined) {
    throw new Error(`--arch must be one of: ${paths.dockerArchOptions.join(", ")}`);
  }
  return { key, arch };
};
