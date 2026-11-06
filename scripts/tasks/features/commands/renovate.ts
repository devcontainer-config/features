import { parseArgs } from "node:util";

import { refreshFeature } from "../renovate.js";
import { featureOption, featureSchema } from "./arguments.js";

export const renovate = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: { feature: featureOption, "dry-run": { type: "boolean", default: false } },
  });
  await refreshFeature(featureSchema.parse(values.feature), values["dry-run"]);
};
