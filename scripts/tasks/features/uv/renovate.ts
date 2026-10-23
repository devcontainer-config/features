import path from "node:path";
import { parseArgs } from "node:util";

import { projectRoot } from "@/scripts/project.js";
import { headFile, refresh } from "@/scripts/tasks/features/renovate.js";

import type { Artifact, FeatureConfig } from "./generateConfig.js";
import { components, configPath, generateConfig, parseConfig, readConfig, rids } from "./generateConfig.js";

const title = "Update uv version pins";
const configFilepath = path.relative(projectRoot, configPath);

interface Pins {
  aliases: string[];
  build?: string;
  "linux-x64": Artifact;
  "linux-arm64": Artifact;
}

const versionChanges = (label: string, before: Pins, after: Pins): string[] => {
  const changes: string[] = [];
  if (before.aliases.join(", ") !== after.aliases.join(", ")) {
    changes.push(`${label}: aliases ${before.aliases.join(", ")} → ${after.aliases.join(", ")}`);
  }
  if (before.build !== after.build) {
    changes.push(`${label}: build ${before.build ?? "-"} → ${after.build ?? "-"}`);
  }
  for (const rid of rids) {
    if (before[rid].url !== after[rid].url) {
      changes.push(`${label}: ${rid} url ${before[rid].url} → ${after[rid].url}`);
    }
    if (before[rid].sha256 !== after[rid].sha256) {
      changes.push(`${label}: ${rid} sha256 ${before[rid].sha256} → ${after[rid].sha256}`);
    }
  }
  return changes;
};

const pinChanges = (previous: FeatureConfig | undefined, next: FeatureConfig): string[] => {
  if (previous === undefined) {
    return components.flatMap((component) => {
      const versions = Object.keys(next.components[component].versions);
      return versions.length === 0 ? [] : [`${component}: added ${versions.join(", ")}`];
    });
  }
  return components.flatMap((component) => {
    const before = previous.components[component].versions;
    const after = next.components[component].versions;
    return [
      ...Object.keys(before)
        .filter((version) => !(version in after))
        .map((version) => `${component}: removed ${version}`),
      ...Object.keys(after)
        .filter((version) => !(version in before))
        .map((version) => `${component}: added ${version}`),
      ...Object.keys(before)
        .filter((version) => version in after)
        .flatMap((version) => versionChanges(`${component} ${version}`, before[version], after[version])),
    ];
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
      branch: "renovate/uv",
      title,
      filepath: configFilepath,
      body: async (headOid) => {
        const changes = pinChanges(await headConfig(headOid), await readConfig());
        if (changes.length === 0) {
          throw new Error(`${configFilepath} changed but no version, alias, build or artifact change was found`);
        }
        return changes.join("\n");
      },
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
