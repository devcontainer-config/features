import { readFile, writeFile } from "node:fs/promises";

import { formatConfig } from "@/scripts/tasks/features/config.js";
import { features } from "@/scripts/tasks/features/features.js";

const formatted = async (configPath: string): Promise<{ actual: string; expected: string }> => {
  const actual = await readFile(configPath, "utf-8");
  return { actual, expected: await formatConfig(JSON.parse(actual), configPath) };
};

const write = async (): Promise<void> => {
  for (const feature of Object.values(features)) {
    const { expected } = await formatted(feature.configPath);
    await writeFile(feature.configPath, expected);
    console.log(`feature-configs: wrote ${feature.configPath}`);
  }
};

const check = async (): Promise<void> => {
  for (const feature of Object.values(features)) {
    const { actual, expected } = await formatted(feature.configPath);
    if (actual !== expected) {
      throw new Error(`${feature.configPath} is not canonically formatted; run pnpm build.`);
    }
  }
};

export const featureConfigs = { write, check } as const;
