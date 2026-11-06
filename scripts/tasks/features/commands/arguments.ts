import { z } from "zod";

import { dockerArchOptions, hostArch } from "../architecture.js";
import type { Feature } from "../feature.js";
import { features } from "../features.js";
import { defaultRefPrefix, mainChannel } from "../tags.js";

export const featureOption = { type: "string" } as const;

export const channelOption = {
  channel: { type: "string", default: mainChannel },
} as const;

export const prefixOption = {
  prefix: { type: "string" },
} as const;

export const channelOptions = { ...channelOption, ...prefixOption } as const;

export const targetOptions = {
  component: { type: "string" },
  version: { type: "string" },
} as const;

export const nonEmptyStringSchema = z.string().min(1);

export const featureSchema = z
  .enum(Object.keys(features) as [keyof typeof features, ...(keyof typeof features)[]])
  .transform((id) => features[id]);

export const archSchema = z.enum(dockerArchOptions).default(hostArch);

export const componentSchemaFor = (feature: Feature) => {
  const [only] = feature.components;
  const schema = z.enum(feature.components);
  return feature.components.length === 1 && only !== undefined ? schema.default(only) : schema;
};

export const targetSchemaFor = (feature: Feature) =>
  z
    .object({
      component: componentSchemaFor(feature),
      version: nonEmptyStringSchema,
    })
    .transform(({ component, version }) => ({ component, key: version }));

export const resolvePrefix = async (value: string | undefined): Promise<string> => value ?? defaultRefPrefix();
