import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { $ } from "execa";

import { packageJson } from "./package.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempPath = "/tmp/devcontainer-config";
const featureInstallPath = path.resolve("/usr/local/devcontainer-config", packageJson.name);
const workspacesPath = process.env.WORKSPACES ?? "/workspaces";
await mkdir(tempPath, { recursive: true });
await mkdir(featureInstallPath, { recursive: true });
await mkdir(workspacesPath, { recursive: true });

process.env.NODE_ENV = "production";
const $$ = $({ stdio: "inherit", verbose: true, cwd: tempPath });
await $$`chmod a=rwx ${workspacesPath}`;
await $$`tsc --project ${path.resolve(__dirname, "tsconfig.install.json")} --outDir .`;
await writeFile(path.resolve(tempPath, "package.json"), JSON.stringify(packageJson, null, 2));
await writeFile(path.resolve(tempPath, "pnpm-workspace.yaml"), "");
await $$`pnpm deploy --filter=dot-config --prod ${featureInstallPath}`;
await $$`npm install --global ${featureInstallPath}`;
await $$`rm --recursive ${tempPath}`;
