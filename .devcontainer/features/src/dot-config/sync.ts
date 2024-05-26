import { hash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import winston from "winston";
import writeFileAtomic from "write-file-atomic";

import { parseConfig } from "./config.js";

export const syncFile = async (
  sourcePath: string,
  targetPath: string,
  eventSource: "source" | "target",
  eventName: "add" | "change" | "unlink",
) => {
  if (eventName === "unlink") {
    if (eventSource === "source") {
      await rm(targetPath, { force: true });
    }
  } else {
    const algorithm = "sha256";
    const source = await readFile(sourcePath).catch(() => undefined);
    const target = await readFile(targetPath).catch(() => undefined);
    const sourceHash = source === undefined ? undefined : hash(algorithm, source);
    const targetHash = target === undefined ? undefined : hash(algorithm, target);
    if (sourceHash !== targetHash) {
      if (eventSource == "source") {
        if (source !== undefined) {
          await mkdir(path.dirname(targetPath), { recursive: true });
          await writeFileAtomic(targetPath, source);
        }
      } else {
        if (target !== undefined) {
          await mkdir(path.dirname(sourcePath), { recursive: true });
          await writeFileAtomic(sourcePath, target);
        }
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
