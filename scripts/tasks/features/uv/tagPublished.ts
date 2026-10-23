import { parseArgs } from "node:util";

import { tagPublished } from "@/scripts/tasks/features/tagPublished.js";
import { mainChannel } from "@/scripts/tasks/features/tags.js";

import { readConfig } from "./generateConfig.js";
import { parseComponent, parseVersion } from "./invocation.js";
import { canonicalTag } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      component: { type: "string" },
      version: { type: "string" },
    },
  });

  const component = parseComponent(values.component);
  const version = parseVersion(values.version);
  const config = await readConfig();
  await tagPublished(`features-uv-${component}-${canonicalTag(config, component, version, mainChannel)}`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
