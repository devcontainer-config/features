import { parseArgs } from "node:util";

import { imageEntries } from "../imageEntries.js";
import { releaseTags } from "../release.js";
import { tagPublished } from "../tagPublished.js";
import { mainChannel } from "../tags.js";
import { channelOptions, featureOption, featureSchema, resolvePrefix } from "./arguments.js";

export const release = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      feature: featureOption,
      ...channelOptions,
    },
  });
  const feature = featureSchema.parse(values.feature);
  const channel = values.channel;
  const prefix = await resolvePrefix(values.prefix);
  const releases = imageEntries(feature, await feature.document(), prefix, channel);
  await releaseTags(releases, prefix);
  if (channel === mainChannel) {
    for (const { gitTag } of releases) {
      await tagPublished(gitTag);
    }
  }
};
