import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { $ } from "execa";
import * as prettier from "prettier";

import prettierOptions from "@/.config/prettier/.prettierrc.json";
import { projectRoot } from "@/scripts/project.js";
import { $$, shellOptions } from "@/scripts/shell.js";

const formatFile = async (path: string) => {
  const text = await readFile(path, "utf-8");
  const formatted = await prettier.format(text, { ...prettierOptions, filepath: path });
  await writeFile(path, formatted);
};

export const build = async () => {
  const tempPath = path.resolve(tmpdir(), randomUUID());
  const featuresPath = path.resolve(projectRoot, ".devcontainer/features/src");
  await mkdir(tempPath, { recursive: true });
  try {
    await $$`git clone --depth 1 --branch v1 https://github.com/devcontainers/action ${tempPath}`;
    await $({
      ...shellOptions,
      cwd: projectRoot,
      env: {
        GITHUB_REF: "refs/heads/dummy",
        GITHUB_REPOSITORY: "owner/repo",
        "INPUT_GENERATE-DOCS": "true",
        "INPUT_BASE-PATH-TO-FEATURES": path.relative(projectRoot, featuresPath),
      },
    })`node ${path.resolve(tempPath, "dist/index.js")}`;
    for (const entry of await readdir(featuresPath, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await formatFile(path.resolve(featuresPath, `${entry.name}/README.md`));
      }
    }
  } finally {
    await rm(tempPath, { recursive: true, force: true });
  }
};
