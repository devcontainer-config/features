import { parseArgs } from "node:util";

import { featureOption, featureSchema } from "./arguments.js";

export const generateConfig = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({ args, options: { feature: featureOption } });
  await featureSchema.parse(values.feature).generateConfig();
};
