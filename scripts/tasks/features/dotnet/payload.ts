import { rename, rm } from "node:fs/promises";
import path from "node:path";

import { $$ } from "@/scripts/shell.js";

import type { Component } from "./generateConfig.js";
import { configPath } from "./generateConfig.js";
import { ensurePackBinary } from "./packBinary.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";

export const ensurePayload = async (
  component: Component,
  version: string,
  arch: DockerArch,
  force: boolean,
): Promise<void> => {
  const outPath = paths.payloadPath(component, version, arch);
  if (!force && (await paths.isFile(path.join(outPath, "dotnet")))) {
    console.log(`Payload already present at ${outPath}; skipping fetch`);
    return;
  }
  const buildBinary = await ensurePackBinary("build", paths.ridFor(paths.hostArch()), force);
  const tempPath = `${outPath}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  await $$`${[
    buildBinary,
    ...["--config", configPath],
    ...["--component", component],
    ...["--version", version],
    ...["--arch", arch],
    ...["--out", tempPath],
  ]}`;
  await rm(outPath, { recursive: true, force: true });
  await rename(tempPath, outPath);
  console.log(`Payload written to ${outPath}`);
};
