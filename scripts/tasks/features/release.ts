import { $ } from "execa";

import { login } from "./registry.js";

const $$inspect = $({ reject: false, stdio: "ignore" });

export interface ReleaseEntry {
  label: string;
  canonical: string;
  tags: readonly string[];
}

export const releaseTags = async (entries: readonly ReleaseEntry[], prefix: string): Promise<void> => {
  await login(prefix);
  for (const entry of entries) {
    const inspect = await $$inspect`docker buildx imagetools inspect ${entry.canonical}`;
    if (inspect.exitCode !== 0) {
      throw new Error(`${entry.label}: canonical tag ${entry.canonical} is missing`);
    }
  }
  for (const entry of entries) {
    await $`docker buildx imagetools create ${entry.tags.flatMap((tag) => ["--tag", tag])} ${entry.canonical}`;
    console.log(`${entry.label}: applied ${entry.tags.join(", ")} to ${entry.canonical}`);
  }
};
