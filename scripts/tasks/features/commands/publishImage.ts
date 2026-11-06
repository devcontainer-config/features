import { parseArgs } from "node:util";

import { dockerArchOptions } from "../architecture.js";
import { assembleBuildContext } from "../buildContext.js";
import { resolveFeatureBinaries } from "../featureBinary.js";
import { pushImage } from "../image.js";
import { imageEntry } from "../imageEntries.js";
import { login } from "../registry.js";
import {
  channelOptions,
  featureOption,
  featureSchema,
  resolvePrefix,
  targetOptions,
  targetSchemaFor,
} from "./arguments.js";

export const publishImage = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      feature: featureOption,
      ...targetOptions,
      ...channelOptions,
      "install-dir": { type: "string" },
    },
  });
  const feature = featureSchema.parse(values.feature);
  const { component, key } = targetSchemaFor(feature).parse(values);
  const channel = values.channel;
  const prefix = await resolvePrefix(values.prefix);
  const entry = imageEntry(feature, await feature.document(), prefix, channel, { component, key });
  const featureBinaries = feature.stage(component, key).binary
    ? await resolveFeatureBinaries(feature, values["install-dir"])
    : {};
  for (const arch of dockerArchOptions) {
    await feature.payload.ensure(component, key, arch, false);
  }
  const context = await assembleBuildContext(feature, component, key, dockerArchOptions, featureBinaries);
  await login(prefix);
  const refs = [entry.canonical];
  await pushImage(context, refs);
  console.log(refs.join("\n"));
};
