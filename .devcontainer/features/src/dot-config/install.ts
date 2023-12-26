import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { $ } from "execa";

import { packageJson } from "./package.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const featureInstallPath = path.resolve("/usr/local/devcontainer-config", packageJson.name);
const workspacesPath = process.env.WORKSPACES ?? "/workspaces";
await mkdir(featureInstallPath, { recursive: true });
await mkdir(workspacesPath, { recursive: true });

process.env.NODE_ENV = "production";
const $$ = $({ stdio: "inherit", verbose: true, cwd: featureInstallPath });
await $$`chmod a=rwx ${workspacesPath}`;
await writeFile(path.resolve(__dirname, "package.json"), JSON.stringify(packageJson, null, 2));
await $$`cp ${path.resolve(__dirname, "package.json")} .`;
await $$`tsc --project ${path.resolve(__dirname, "tsconfig.install.json")} --outDir .`;
await $$`npm install`;
await $$`npm install --global .`;
