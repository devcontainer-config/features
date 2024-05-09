import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { hashFile } from "hasha";
import winston from "winston";

import { parseConfig } from "./config.js";

export const syncFile = async (
  sourcePath: string,
  targetPath: string,
  eventSource: "source" | "target",
  eventName: "add" | "change" | "unlink",
) => {
  if (eventName === "unlink") {
    if (eventSource == "source") {
      await rm(targetPath, { force: true });
    }
  } else {
    const sourceHash = await hashFile(sourcePath).catch(() => undefined);
    const targetHash = await hashFile(targetPath).catch(() => undefined);
    if (sourceHash != targetHash) {
      if (eventSource == "source") {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await copyFile(sourcePath, targetPath);
      } else {
        await mkdir(path.dirname(sourcePath), { recursive: true });
        await copyFile(targetPath, sourcePath);
      }
    }
  }
};

export const sync = async (projectRoot: string) => {
  const mappings = await parseConfig(projectRoot);
  for (const { sourcePath, targetPath } of mappings) {
    winston.info(`[sync] ${sourcePath} -> ${targetPath}`);
    await syncFile(sourcePath, targetPath, "source", "add");
  }
};
