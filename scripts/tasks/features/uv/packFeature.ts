import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { createTar } from "@/scripts/tasks/features/tar.js";

import { rids } from "./generateConfig.js";
import { ensureFeatureBinary } from "./packBinary.js";

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
  const binary = await ensureFeatureBinary(rid, values.force);
  const out = path.resolve(values.out);
  const archive = path.join(out, `${rid}.tar`);
  await mkdir(out, { recursive: true });
  await createTar(archive, path.dirname(binary), [path.basename(binary)]);
  console.log(`Feature binary archive written to ${archive}`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
