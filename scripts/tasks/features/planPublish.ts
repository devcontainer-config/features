import { appendFile } from "node:fs/promises";

import { $ } from "execa";

import type { ConfigEntry } from "./config.js";
import type { ImageEntry } from "./imageEntries.js";
import { login } from "./registry.js";
import { mainChannel } from "./tags.js";

const $$inspect = $({ reject: false, stdio: "ignore" });

export interface PlanRunner {
  label: string;
  arm64: boolean;
}

export interface PlanOptions {
  channel: string;
  prefix: string;
  // The runners the smoke matrix fans out over, with the architecture each one builds for.
  runners: readonly PlanRunner[];
}

export const planPublish = async (entries: readonly ImageEntry[], options: PlanOptions): Promise<void> => {
  if (options.channel === mainChannel) {
    await login(options.prefix);
  }
  const listed: ConfigEntry[] = [];
  for (const entry of entries) {
    if (options.channel === mainChannel) {
      const inspect = await $$inspect`docker buildx imagetools inspect ${entry.canonical}`;
      if (inspect.exitCode === 0) {
        console.log(`${entry.label}: already published (${entry.canonical})`);
        continue;
      }
    }
    console.log(`${entry.label}: to publish (${entry.refs.join(", ")})`);
    listed.push(entry.entry);
  }

  const matrix = { include: listed };
  const smoke = {
    include: entries.flatMap(({ entry }) =>
      options.runners.map(({ label, arm64 }) => ({ label, arm64, component: entry.component, key: entry.key })),
    ),
  };
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput !== undefined && githubOutput !== "") {
    await appendFile(githubOutput, `matrix=${listed.length === 0 ? "" : JSON.stringify(matrix)}\n`);
    await appendFile(githubOutput, `smoke=${JSON.stringify(smoke)}\n`);
    await appendFile(githubOutput, `channel=${options.channel}\n`);
  }
  console.log(`${listed.length} of ${entries.length} entries to publish on channel ${options.channel}`);
};
