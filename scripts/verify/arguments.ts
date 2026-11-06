import { parseArgs } from "node:util";

import { z } from "zod";

import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

export const imagesModes = ["build", "pull"] as const;
export type ImagesMode = (typeof imagesModes)[number];

export const imagesSchema = z.enum(imagesModes);

export const verifyOptions = {
  force: { type: "boolean", default: false },
  rmi: { type: "boolean", default: false },
  scenario: { type: "string", multiple: true },
  component: { type: "string" },
  version: { type: "string" },
  images: { type: "string", default: "build" },
  channel: { type: "string", default: mainChannel },
  prefix: { type: "string" },
} as const;

export interface VerifyOptions {
  images: ImagesMode;
  channel: string;
  prefix: string;
  force: boolean;
  rmi: boolean;
}

export interface VerifyArguments {
  options: VerifyOptions;
  scenarios: readonly string[];
  component: string | undefined;
  version: string | undefined;
}

export const parseVerifyArguments = async (argv: string[]): Promise<VerifyArguments> => {
  const { values } = parseArgs({ args: argv, options: verifyOptions });
  return {
    options: {
      images: imagesSchema.parse(values.images),
      channel: values.channel,
      prefix: values.prefix ?? (await defaultRefPrefix()),
      force: values.force,
      rmi: values.rmi,
    },
    scenarios: values.scenario ?? [],
    component: values.component,
    version: values.version,
  };
};

export const selectionSchema = <Name extends string>(
  nameSchema: z.ZodType<Name>,
  names: readonly Name[],
  defaultSelection: readonly Name[],
) =>
  z
    .array(nameSchema)
    .default([])
    .transform((selected) =>
      selected.length === 0 ? defaultSelection : names.filter((name) => selected.includes(name)),
    );

export const targetSchema = <Component extends string>(componentSchema: z.ZodType<Component>) =>
  z
    .object({
      component: componentSchema.optional(),
      version: z.string().min(1).optional(),
    })
    .refine((value) => (value.component === undefined) === (value.version === undefined), {
      message: "--component and --version must be provided together",
    })
    .transform((value) =>
      value.component === undefined || value.version === undefined
        ? undefined
        : { component: value.component, key: value.version },
    );

export const requireSmokeTarget = <Component extends string>(
  scenarios: readonly string[],
  target: { component: Component; key: string } | undefined,
): void => {
  if (target === undefined && scenarios.includes("smoke")) {
    throw new Error("--scenario smoke requires --component and --version");
  }
};
