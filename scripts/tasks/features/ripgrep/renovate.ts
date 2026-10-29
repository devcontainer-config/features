import path from "node:path";
import { parseArgs } from "node:util";

import { projectRoot } from "@/scripts/project.js";
import type { ConfigDocument } from "@/scripts/tasks/features/renovate.js";
import { refreshFeatureConfig } from "@/scripts/tasks/features/renovate.js";

import type { FeatureConfig } from "./generateConfig.js";
import { configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";

const document = (config: FeatureConfig): ConfigDocument => ({
  revision: config.revision,
  namespaces: [{ name: "ripgrep", versions: config.versions, aliases: config.aliases }],
});

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
    },
  });

  await refreshFeatureConfig(
    {
      branch: "renovate-ripgrep",
      title: "Update ripgrep version pins",
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
