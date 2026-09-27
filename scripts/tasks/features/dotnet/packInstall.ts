import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { rids } from "./generateConfig.js";
import { ensurePackBinary } from "./packBinary.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      rid: { type: "string" },
      out: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });

  const rid = rids.find((candidate) => candidate === values.rid);
  if (rid === undefined) {
    throw new Error(`--rid must be one of: ${rids.join(", ")}`);
  }
  if (values.out === undefined || values.out === "") {
    throw new Error("--out is required");
  }
  const binary = await ensurePackBinary("install", rid, values.force);
  const target = path.join(path.resolve(values.out), rid, "install");
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(binary, target);
  console.log(`Install binary written to ${target}`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
