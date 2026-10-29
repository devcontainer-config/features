import path from "node:path";
import { parseArgs } from "node:util";

import { projectRoot } from "@/scripts/project.js";
import type { ConfigDocument } from "@/scripts/tasks/features/renovate.js";
import { refreshFeatureConfig } from "@/scripts/tasks/features/renovate.js";

import type { FeatureConfig } from "./generateConfig.js";
import { components, configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";

const document = (config: FeatureConfig): ConfigDocument => ({
  revision: config.revision,
  namespaces: components.map((component) => ({
    name: component,
    versions: config.components[component].versions,
    aliases: config.components[component].aliases,
  })),
});

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
    },
  });

  await refreshFeatureConfig(
    {
      branch: "renovate-dotnet",
      title: "Update dotnet version pins",
      filepath: path.relative(projectRoot, configPath),
      generate: generateConfig,
      read: readConfig,
      parse: parseConfig,
      document,
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
