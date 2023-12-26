import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { hashFile } from "hasha";
import winston from "winston";

import { parseConfig } from "./config.js";

export const syncFile = async (source: string, target: string, event: "add" | "change" | "unlink") => {
  if (event === "unlink") {
    await rm(target, { force: true });
  } else {
    const sourceHash = await hashFile(source).catch(() => undefined);
    const targetHash = await hashFile(target).catch(() => undefined);
    if (sourceHash !== undefined && sourceHash !== targetHash) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }
};

export const sync = async (projectRoot: string) => {
  const mappings = await parseConfig(projectRoot);
  for (const { sourcePath, targetPath } of mappings) {
    winston.info(`[sync] ${sourcePath} -> ${targetPath}`);
    await syncFile(sourcePath, targetPath, "add");
  }
};
