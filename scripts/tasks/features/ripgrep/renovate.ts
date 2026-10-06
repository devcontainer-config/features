import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import git from "isomorphic-git";

import { projectRoot } from "@/scripts/project.js";
import { refresh } from "@/scripts/tasks/features/renovate.js";

import type { FeatureConfig } from "./generateConfig.js";
import { configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";

const title = "Update ripgrep version pins";
const configFilepath = path.relative(projectRoot, configPath);
const textDecoder = new TextDecoder();

const versionPins = (previous: FeatureConfig, next: FeatureConfig): string[] => {
  const before = Object.keys(previous.versions);
  const after = Object.keys(next.versions);
  const removed = before.filter((version) => !after.includes(version));
  const added = after.filter((version) => !before.includes(version));
  if (removed.length === 0 && added.length === 0) {
    return [];
  }
  return [`${removed.join(", ")} → ${added.join(", ")}`];
};

const headConfig = async (oid: string): Promise<FeatureConfig> => {
  const { blob } = await git.readBlob({ fs, dir: projectRoot, oid, filepath: configFilepath });
  return parseConfig(textDecoder.decode(blob), `${configFilepath} at HEAD`);
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
    },
  });

  await generateConfig();
  await refresh(
    {
      branch: "renovate/ripgrep",
      title,
      filepath: configFilepath,
      body: async (headOid) => versionPins(await headConfig(headOid), await readConfig()).join("\n"),
    },
    values["dry-run"],
  );
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
