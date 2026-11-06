import { readdir } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { projectRoot } from "@/scripts/project.js";

const main = async (): Promise<void> => {
  const [name, ...rest] = process.argv.slice(2);
  const verifyPath = path.join(projectRoot, "scripts", "verify");
  const names = (await readdir(verifyPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const featureSchema = z.enum(names as [string, ...string[]]);
  const feature = featureSchema.parse(name);

  const { verify } = (await import(`@/scripts/verify/${feature}/verify.js`)) as {
    verify?: (argv: string[]) => Promise<void>;
  };
  if (verify === undefined) {
    throw new Error(`scripts/verify/${feature}/verify.ts does not export verify(argv: string[])`);
  }
  await verify(rest);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
