import { cp, mkdir, mkdtempDisposable, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { $ } from "execa";

import { projectRoot } from "@/scripts/project.js";
import { shellOptions } from "@/scripts/shell.js";

export interface DevContainerRunner extends AsyncDisposable {
  workspaceFolder: string;
  start(options?: { skipPostCreate?: boolean }): Promise<void>;
  exec(command: string, ...args: string[]): Promise<void>;
}

export const createDevContainerRunner = async (env: Record<string, string> = {}): Promise<DevContainerRunner> => {
  const tempPath = await mkdtempDisposable(path.join(tmpdir(), "devcontainer-runner-"));
  const workspacePath = path.resolve(tempPath.path, path.basename(projectRoot));
  await mkdir(workspacePath, { recursive: true });
  const composeProject = path.basename(tempPath.path).toLowerCase();
  const $$ = $({ ...shellOptions, cwd: workspacePath, env: { COMPOSE_PROJECT_NAME: composeProject } });

  await cp(projectRoot, workspacePath, {
    recursive: true,
    filter: (src) => path.basename(src) !== "node_modules",
  });

  const remoteEnv = Object.entries(env).flatMap(([key, value]) => ["--remote-env", `${key}=${value}`]);

  return {
    workspaceFolder: workspacePath,
    start: async ({ skipPostCreate = false } = {}) => {
      await $$`devcontainer build`;
      await $$`devcontainer up --remove-existing-container ${skipPostCreate ? ["--skip-post-create"] : []} ${remoteEnv}`;
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
        env: { COMPOSE_PROJECT_NAME: composeProject },
      })`devcontainer up --remove-existing-container`;

      await removeComposeProject(composeProject);

      await tempPath.remove();
    },
  };
};

const removeComposeProject = async (composeProject: string): Promise<void> => {
  const filter = `label=com.docker.compose.project=${composeProject}`;
  const $docker = $({ reject: false, stdin: "ignore", stderr: "ignore" });
  for (const { list, format, remove } of [
    { list: ["ps", "-a"], format: "{{.ID}}", remove: ["rm", "--force"] },
    { list: ["volume", "ls"], format: "{{.Name}}", remove: ["volume", "rm"] },
    { list: ["network", "ls"], format: "{{.ID}}", remove: ["network", "rm"] },
    { list: ["images"], format: "{{.ID}}", remove: ["image", "rm", "--force"] },
  ] as const) {
    const { stdout } = await $docker`docker ${[...list, "--filter", filter, "--format", format]}`;
    const ids = [...new Set(stdout.split("\n").filter(Boolean))];
    if (ids.length > 0) {
      await $docker`docker ${[...remove, ...ids]}`;
    }
  }
};
