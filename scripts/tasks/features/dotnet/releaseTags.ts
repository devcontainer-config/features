import { parseArgs } from "node:util";

import type { ReleaseEntry } from "@/scripts/tasks/features/release.js";
import { releaseTags } from "@/scripts/tasks/features/release.js";
import { tagPublished } from "@/scripts/tasks/features/tagPublished.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { components, readConfig } from "./generateConfig.js";
import { imageRef, imageRefs, tagNames } from "./tags.js";

interface FeatureReleaseEntry extends ReleaseEntry {
  gitTag: string;
}

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      channel: { type: "string", default: mainChannel },
      prefix: { type: "string" },
      "git-tags": { type: "boolean", default: false },
    },
  });

  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  const config = await readConfig();
  const entries: FeatureReleaseEntry[] = components.flatMap((component) =>
    Object.keys(config.components[component].versions).map((key) => {
      const tags = tagNames(config, component, key, channel);
      return {
        label: `${component} ${key}`,
        canonical: imageRef(prefix, component, tags.canonical),
        tags: imageRefs(prefix, component, tags.claims),
        gitTag: `features-dotnet-${component}-${tagNames(config, component, key, mainChannel).canonical}`,
      };
    }),
  );
  await releaseTags(entries, prefix);
  if (values["git-tags"]) {
    for (const { gitTag } of entries) {
      await tagPublished(gitTag);
    }
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
