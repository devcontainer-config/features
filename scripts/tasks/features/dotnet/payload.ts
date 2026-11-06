import { rename, rm } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";

import type { DockerArch } from "../architecture.js";
import { hostArch, isFile, ridFor } from "../architecture.js";
import { payloadPath } from "../paths.js";
import type { Component } from "./generateConfig.js";
import { configPath } from "./generateConfig.js";
import { ensureBuildBinary } from "./packBinary.js";

export const payloadPresent = (component: Component, key: string, arch: DockerArch): Promise<boolean> =>
  isFile(path.join(payloadPath("dotnet", component, key, arch), "dotnet"));

export const ensurePayload = async (
  component: Component,
  key: string,
  arch: DockerArch,
  force: boolean,
): Promise<void> => {
  const outPath = payloadPath("dotnet", component, key, arch);
  if (!force && (await payloadPresent(component, key, arch))) {
    console.log(`Payload already present at ${outPath}; skipping fetch`);
    return;
  }
  const buildBinary = await ensureBuildBinary(ridFor(hostArch()), force);
  const tempPath = `${outPath}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  await $$`${[
    buildBinary,
    ...["--config", configPath],
    ...["--component", component],
    ...["--version", key],
    ...["--arch", arch],
    ...["--out", tempPath],
  ]}`;
  await rm(outPath, { recursive: true, force: true });
  await rename(tempPath, outPath);
  console.log(`Payload written to ${outPath}`);
};
