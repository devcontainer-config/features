import { parseArgs } from "node:util";

import { planPublish } from "@/scripts/tasks/features/planPublish.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { readConfig } from "./generateConfig.js";
import { imageRef, tagNames } from "./tags.js";

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
  await planPublish(
    Object.keys(config.versions).map((key) => {
      const tags = tagNames(config, key, channel);
      return {
        label: key,
        canonical: imageRef(prefix, tags.canonical),
        tags: tags.all,
        entry: { key },
      };
    }),
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
