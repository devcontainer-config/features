import { parseArgs } from "node:util";

import type { ReleaseEntry } from "@/scripts/tasks/features/release.js";
import { releaseTags } from "@/scripts/tasks/features/release.js";
import { tagPublished } from "@/scripts/tasks/features/tagPublished.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { readConfig } from "./generateConfig.js";
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
  const entries: FeatureReleaseEntry[] = Object.keys(config.versions).map((key) => {
    const tags = tagNames(config, key, channel);
    return {
      label: key,
      canonical: imageRef(prefix, tags.canonical),
      tags: imageRefs(prefix, tags.claims),
      gitTag: `features-ripgrep-${tagNames(config, key, mainChannel).canonical}`,
    };
  });
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
