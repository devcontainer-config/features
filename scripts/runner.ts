import { cp, mkdir, mkdtempDisposable, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { $ } from "execa";

import { projectRoot } from "@/scripts/project.js";
import { shellOptions } from "@/scripts/shell.js";

export interface DevContainerRunner extends AsyncDisposable {
  workspaceFolder: string;
  start(): Promise<void>;
  exec(command: string, ...args: string[]): Promise<void>;
}

export const createDevContainerRunner = async (env: Record<string, string> = {}): Promise<DevContainerRunner> => {
  const tempPath = await mkdtempDisposable(path.join(tmpdir(), "devcontainer-runner-"));
  const workspacePath = path.resolve(tempPath.path, path.basename(projectRoot));
  await mkdir(workspacePath, { recursive: true });
  const $$ = $({ ...shellOptions, cwd: workspacePath });

  await cp(projectRoot, workspacePath, {
    recursive: true,
    filter: (src) => path.basename(src) !== "node_modules",
  });

  const remoteEnv = Object.entries(env).flatMap(([key, value]) => ["--remote-env", `${key}=${value}`]);

  return {
    workspaceFolder: workspacePath,
    start: async () => {
      await $$`devcontainer build`;
      await $$`devcontainer up --remove-existing-container ${remoteEnv}`;
    },
    exec: async (command: string, ...args: string[]): Promise<void> => {
      await $$`devcontainer exec ${remoteEnv} ${command} ${args}`;
    },
    async [Symbol.asyncDispose]() {
      // https://github.com/devcontainers/cli/issues/386
      await rm(path.join(workspacePath, ".devcontainer/Dockerfile"));
      await $({
        cwd: workspacePath,
        reject: false,
        stdio: "ignore",
      })`devcontainer up --remove-existing-container`;

      await tempPath.remove();
    },
  };
};
