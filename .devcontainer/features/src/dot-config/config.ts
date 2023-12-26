import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const sourcePathSchema = z.string().describe("Relative path to .config/${key}");
const targetPathSchema = z.string().describe("Absolute path/relative path to workspaces");
const dotConfigSchema = z.record(z.string(), z.record(sourcePathSchema, targetPathSchema));

export const getDotConfigJsonPath = (projectRoot: string) => path.resolve(projectRoot, ".devcontainer/dot-config.json");

export const parseConfig = async (projectRoot: string) => {
  const workspaces = path.resolve(projectRoot, "..");
  const configRoot = path.resolve(projectRoot, ".config");
  const configText = await readFile(getDotConfigJsonPath(projectRoot), "utf-8");
  const config = dotConfigSchema.parse(JSON.parse(configText));

  const mappings: { sourcePath: string; targetPath: string }[] = [];
  for (const [key, files] of Object.entries(config)) {
    const configPath = path.resolve(configRoot, key);
    for (const [source, target] of Object.entries(files)) {
      const sourcePath = path.resolve(configPath, source);
      const targetPath = path.resolve(workspaces, target);
      mappings.push({ sourcePath, targetPath });
    }
  }
  return mappings;
};
