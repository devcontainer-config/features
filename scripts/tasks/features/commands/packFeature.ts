import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { hostArch, ridFor, rids } from "../architecture.js";
import { requireBinary } from "../feature.js";
import { createTar } from "../tar.js";
import { featureOption, featureSchema, nonEmptyStringSchema } from "./arguments.js";

const ridSchema = z.enum(rids);

const outSchema = nonEmptyStringSchema.transform((value) => path.resolve(value));

export const packFeature = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      feature: featureOption,
      rid: { type: "string" },
      out: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  const feature = featureSchema.parse(values.feature);
  const binary = requireBinary(feature);
  const rid = ridSchema.parse(values.rid);
  if (rid !== ridFor(hostArch())) {
    throw new Error(`--rid ${rid} does not match the host RID: a local pack builds ${ridFor(hostArch())}`);
  }
  const out = outSchema.parse(values.out);
  const binaryPath = await binary.ensure(rid, values.force);
  const archive = path.join(out, `${rid}.tar`);
  await mkdir(out, { recursive: true });
  await createTar(archive, path.dirname(binaryPath), [path.basename(binaryPath)]);
  console.log(`Feature binary archive written to ${archive}`);
};
