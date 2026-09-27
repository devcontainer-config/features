import type { Component } from "./generateConfig.js";
import { components } from "./generateConfig.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

export interface Invocation {
  component: Component;
  version: string;
  arch: DockerArch;
}

export const parseComponent = (value: string | undefined): Component => {
  const component = components.find((candidate) => candidate === value);
  if (component === undefined) {
    throw new Error(`--component must be one of: ${components.join(", ")}`);
  }
  return component;
};

export const parseVersion = (value: string | undefined): string => {
  if (value === undefined || value === "") {
    throw new Error("--version is required");
  }
  return value;
};

export const parseInvocation = (values: { component?: string; version?: string; arch?: string }): Invocation => {
  const component = parseComponent(values.component);
  const version = parseVersion(values.version);
  const arch =
    values.arch === undefined
      ? paths.hostArch()
      : paths.dockerArchOptions.find((candidate) => candidate === values.arch);
  if (arch === undefined) {
    throw new Error(`--arch must be one of: ${paths.dockerArchOptions.join(", ")}`);
  }
  return { component, version, arch };
};
