import path from "node:path";
import { parseArgs } from "node:util";

import { projectRoot } from "@/scripts/project.js";
import { headFile, refresh } from "@/scripts/tasks/features/renovate.js";

import type { Component, FeatureConfig } from "./generateConfig.js";
import { components, configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";

const title = "Update dotnet version pins";
const configFilepath = path.relative(projectRoot, configPath);

const versionPins = (previous: FeatureConfig | undefined, next: FeatureConfig): string[] => {
  if (previous === undefined) {
    return components.flatMap((component) => {
      const versions = Object.keys(next.components[component].versions);
      return versions.length === 0 ? [] : [`${component}: added ${versions.join(", ")}`];
    });
  }
  return components.flatMap((component: Component) => {
    const before = Object.keys(previous.components[component].versions);
    const after = Object.keys(next.components[component].versions);
    const removed = before.filter((version) => !after.includes(version));
    const added = after.filter((version) => !before.includes(version));
    if (removed.length === 0 && added.length === 0) {
      return [];
    }
    return [`${component}: ${removed.join(", ")} → ${added.join(", ")}`];
  });
};

const headConfig = async (oid: string): Promise<FeatureConfig | undefined> => {
  const text = await headFile(oid, configFilepath);
  return text === undefined ? undefined : parseConfig(text, `${configFilepath} at HEAD`);
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
      branch: "renovate",
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
