import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { $ } from "execa";

import type { Component } from "./generateConfig.js";
import { components, readConfig } from "./generateConfig.js";
import { login } from "./registry.js";
import { canonicalTag, defaultRefPrefix, imageRef, mainChannel, tagNames } from "./tags.js";

interface PlanEntry {
  component: Component;
  version: string;
}

const $$inspect = $({ reject: false, stdio: "ignore" });

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      channel: { type: "string", default: mainChannel },
      out: { type: "string", default: ".ci/plan.json" },
      prefix: { type: "string" },
    },
  });

  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  const config = await readConfig();
  const pairs = components.flatMap((component) =>
    Object.keys(config.components[component].versions).map((version) => ({ component, version })),
  );
  const derived = pairs.map(({ component, version }) => ({
    component,
    version,
    canonical: imageRef(prefix, component, canonicalTag(config, component, version, channel)),
    tags: tagNames(config, component, version, channel),
  }));

  if (channel === mainChannel) {
    await login(prefix);
  }
  const listed: PlanEntry[] = [];
  for (const pair of derived) {
    if (channel === mainChannel) {
      const inspect = await $$inspect`docker buildx imagetools inspect ${pair.canonical}`;
      if (inspect.exitCode === 0) {
        console.log(`${pair.component} ${pair.version}: already published (${pair.canonical})`);
        continue;
      }
    }
    console.log(`${pair.component} ${pair.version}: to publish (${pair.tags.join(", ")})`);
    listed.push({ component: pair.component, version: pair.version });
  }

  const plan = { include: listed };
  const outPath = path.resolve(values.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(plan, null, 2)}\n`);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput !== undefined && githubOutput !== "") {
    await appendFile(githubOutput, `matrix=${listed.length === 0 ? "" : JSON.stringify(plan)}\n`);
  }
  console.log(`${listed.length} of ${pairs.length} pairs to publish (${outPath})`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
