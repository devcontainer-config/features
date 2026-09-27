import { readdir } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";

const main = async (): Promise<void> => {
  const [name, ...rest] = process.argv.slice(2);
  const verifyPath = path.join(projectRoot, "scripts", "verify");
  const names = (await readdir(verifyPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (name === undefined || !names.includes(name)) {
    throw new Error(`First argument must be a feature name (one of: ${names.join(", ")})`);
  }

  const { verify } = (await import(`@/scripts/verify/${name}/verify.js`)) as {
    verify?: (argv: string[]) => Promise<void>;
  };
  if (verify === undefined) {
    throw new Error(`scripts/verify/${name}/verify.ts does not export verify(argv: string[])`);
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
