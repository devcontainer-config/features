import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { $ } from "execa";

import { cachePath } from "./config.js";
import { packageJson } from "./package.js";

const insertShebang = async (path: string) => {
  const content = await readFile(path, "utf-8");
  await writeFile(path, `#!/usr/bin/env node\n${content}`);
};

export const install = async () => {
  const featureInstallPath = path.resolve("/usr/local/devcontainer-config", packageJson.name);
  if (import.meta.dirname == featureInstallPath) {
    console.log("Already installed.");
    return;
  }

  const workspacesPath = process.env.WORKSPACES ?? "/workspaces";
  await mkdir(workspacesPath, { recursive: true });
  await mkdir(cachePath, { recursive: true });
  if (path.basename(import.meta.dirname) === "dist") {
    // called from install.dist.sh.
    const $$ = $({ stdio: "inherit", verbose: "full" });
    await $$`chmod -R a=rwx ${workspacesPath}`;
    await $$`chmod -R a=rwx ${cachePath}`;

    await cp(import.meta.dirname, featureInstallPath, { recursive: true, verbatimSymlinks: true });
    await $$`npm install --global ${featureInstallPath}`;
  } else {
    // For development only (this repository).
    const tempPath = "/tmp/devcontainer-config";
    await mkdir(tempPath, { recursive: true });
    await mkdir(featureInstallPath, { recursive: true });

    const $$ = $({
      stdio: "inherit",
      verbose: "full",
      cwd: tempPath,
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    });
    await $$`chmod -R a=rwx ${workspacesPath}`;
    await $$`chmod -R a=rwx ${cachePath}`;

    await $$`tsc --project ${import.meta.dirname} --noEmit false --outDir .`;
    await writeFile(path.resolve(tempPath, "package.json"), JSON.stringify(packageJson, null, 2));
    await writeFile(path.resolve(tempPath, "pnpm-workspace.yaml"), "");
    await insertShebang(path.resolve(tempPath, "index.js"));
    await $$`pnpm install`;
    await $$`pnpm deploy --filter=dot-config --prod ${featureInstallPath}`;
    await $$`pnpm install --global ${featureInstallPath}`;
    await $$`rm --recursive ${tempPath}`;
  }
};
