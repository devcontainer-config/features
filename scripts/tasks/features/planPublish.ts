import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { $ } from "execa";

import { login } from "./registry.js";
import { mainChannel } from "./tags.js";

const $$inspect = $({ reject: false, stdio: "ignore" });

export interface PlanCandidate<Entry> {
  label: string;
  canonical: string;
  tags: readonly string[];
  entry: Entry;
}

export interface PlanOptions {
  channel: string;
  prefix: string;
  out: string;
}

export const planPublish = async <Entry>(
  candidates: readonly PlanCandidate<Entry>[],
  options: PlanOptions,
): Promise<void> => {
  if (options.channel === mainChannel) {
    await login(options.prefix);
  }
  const listed: Entry[] = [];
  for (const candidate of candidates) {
    if (options.channel === mainChannel) {
      const inspect = await $$inspect`docker buildx imagetools inspect ${candidate.canonical}`;
      if (inspect.exitCode === 0) {
        console.log(`${candidate.label}: already published (${candidate.canonical})`);
        continue;
      }
    }
    console.log(`${candidate.label}: to publish (${candidate.tags.join(", ")})`);
    listed.push(candidate.entry);
  }

  const plan = { include: listed };
  const outPath = path.resolve(options.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(plan, null, 2)}\n`);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput !== undefined && githubOutput !== "") {
    await appendFile(githubOutput, `matrix=${listed.length === 0 ? "" : JSON.stringify(plan)}\n`);
  }
  console.log(`${listed.length} of ${candidates.length} entries to publish (${outPath})`);
};
