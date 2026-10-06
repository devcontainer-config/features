import { parseArgs } from "node:util";

import { parseInvocation } from "./invocation.js";
import { ensurePayload } from "./payload.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
      arch: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });

  const { version, arch } = parseInvocation(values);
  await ensurePayload(version, arch, values.force);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
