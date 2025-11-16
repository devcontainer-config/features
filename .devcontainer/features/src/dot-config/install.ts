import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { $ } from "execa";

import { packageJson } from "./package.js";

const insertShebang = async (path: string) => {
  const content = await readFile(path, "utf-8");
  await writeFile(path, `#!/usr/bin/env node\n${content}`);
};

const tempPath = "/tmp/devcontainer-config";
const featureInstallPath = path.resolve("/usr/local/devcontainer-config", packageJson.name);
const workspacesPath = process.env.WORKSPACES ?? "/workspaces";
await mkdir(tempPath, { recursive: true });
await mkdir(featureInstallPath, { recursive: true });
await mkdir(workspacesPath, { recursive: true });

const $$ = $({
  stdio: "inherit",
  verbose: "full",
  cwd: tempPath,
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});
await $$`chmod a=rwx ${workspacesPath}`;
await $$`tsc --project ${path.resolve(import.meta.dirname, "tsconfig.install.json")} --outDir .`;
await writeFile(path.resolve(tempPath, "package.json"), JSON.stringify(packageJson, null, 2));
await writeFile(path.resolve(tempPath, "pnpm-workspace.yaml"), "");
await insertShebang(path.resolve(tempPath, "index.js"));
await $$`pnpm install`;
await $$`pnpm deploy --filter=dot-config --prod ${featureInstallPath}`;
await $$`pnpm install --global ${featureInstallPath}`;
await $$`rm --recursive ${tempPath}`;
