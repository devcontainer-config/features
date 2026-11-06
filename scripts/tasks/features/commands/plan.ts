import { parseArgs } from "node:util";

import { z } from "zod";

import { imageEntries } from "../imageEntries.js";
import { planPublish } from "../planPublish.js";
import { deriveChannel } from "../tags.js";
import { featureOption, featureSchema, nonEmptyStringSchema, prefixOption, resolvePrefix } from "./arguments.js";

const pullRequestSchema = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^[1-9][0-9]*$/u)
    .transform(Number)
    .pipe(z.int())
    .optional(),
);

const runnerSchema = z.object({
  label: nonEmptyStringSchema,
  arm64: z.boolean(),
});

const runnersSchema = z
  .string()
  .transform((value) => JSON.parse(value) as unknown)
  .pipe(z.array(runnerSchema).min(1));

export const plan = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      feature: featureOption,
      ...prefixOption,
      runners: { type: "string" },
      ref: { type: "string" },
      "pull-request": { type: "string" },
    },
  });
  const feature = featureSchema.parse(values.feature);
  const runners = runnersSchema.parse(values.runners);
  const channel = deriveChannel(
    nonEmptyStringSchema.parse(values.ref),
    pullRequestSchema.parse(values["pull-request"]),
  );
  const prefix = await resolvePrefix(values.prefix);
  const document = await feature.document();
  await planPublish(imageEntries(feature, document, prefix, channel), {
    channel,
    prefix,
    runners,
  });
};
