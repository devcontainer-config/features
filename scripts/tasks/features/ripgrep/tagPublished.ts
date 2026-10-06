import { parseArgs } from "node:util";

import { tagPublished } from "@/scripts/tasks/features/tagPublished.js";
import { mainChannel } from "@/scripts/tasks/features/tags.js";

import { readConfig } from "./generateConfig.js";
import { parseVersion } from "./invocation.js";
import { canonicalTag } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
    },
  });

  const version = parseVersion(values.version);
  const config = await readConfig();
  await tagPublished(`features-ripgrep-${canonicalTag(config, version, mainChannel)}`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
