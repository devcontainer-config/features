import { z } from "zod";

import { buildImage } from "./commands/buildImage.js";
import { fetchPayload } from "./commands/fetchPayload.js";
import { generateConfig } from "./commands/generateConfig.js";
import { packFeature } from "./commands/packFeature.js";
import { plan } from "./commands/plan.js";
import { publishImage } from "./commands/publishImage.js";
import { release } from "./commands/release.js";
import { renovate } from "./commands/renovate.js";

const commands: Readonly<Record<string, (args: string[]) => Promise<void>>> = {
  "generate-config": generateConfig,
  renovate,
  "plan-publish": plan,
  "fetch-payload": fetchPayload,
  "pack-feature": packFeature,
  "build-image": buildImage,
  "publish-image": publishImage,
  "release-tags": release,
};

const commandSchema = z.enum(Object.keys(commands) as [string, ...string[]]);

const main = async (): Promise<void> => {
  const [name, ...args] = process.argv.slice(2);
  await commands[commandSchema.parse(name)](args);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
