import { parseArgs } from "node:util";

import { planPublish } from "@/scripts/tasks/features/planPublish.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { components, readConfig } from "./generateConfig.js";
import { canonicalTag, imageRef, tagNames } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      channel: { type: "string", default: mainChannel },
      out: { type: "string", default: ".ci/plan.json" },
      prefix: { type: "string" },
    },
  });

  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  const config = await readConfig();
  const pairs = components.flatMap((component) =>
    Object.keys(config.components[component].versions).map((version) => ({ component, version })),
  );
  await planPublish(
    pairs.map(({ component, version }) => ({
      label: `${component} ${version}`,
      canonical: imageRef(prefix, component, canonicalTag(config, component, version, channel)),
      tags: tagNames(config, component, version, channel),
      entry: { component, version },
    })),
    { channel, prefix, out: values.out },
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
