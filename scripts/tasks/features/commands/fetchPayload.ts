import { parseArgs } from "node:util";

import { archSchema, featureOption, featureSchema, targetOptions, targetSchemaFor } from "./arguments.js";

export const fetchPayload = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      feature: featureOption,
      ...targetOptions,
      arch: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  const feature = featureSchema.parse(values.feature);
  const { component, key } = targetSchemaFor(feature).parse(values);
  await feature.payload.ensure(component, key, archSchema.parse(values.arch), values.force);
};
