import { mkdir, writeFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { $ } from "execa";

import { projectRoot } from "@/scripts/project.js";
import { project$$ } from "@/scripts/shell.js";
import { login } from "@/scripts/tasks/features/dotnet/registry.js";

import type { ComponentImage } from "./selection.js";

const baseImage = "mcr.microsoft.com/devcontainers/base:debian";
const remoteUser = "verify";

const $$docker = $({ reject: false, stdin: "ignore", stderr: "ignore" });
const $$exec = $({ reject: false, stdio: ["ignore", "pipe", "pipe"], verbose: "full", cwd: projectRoot });

export interface Workspace {
  path: string;
  containerPath: string;
}

export interface Command {
  command: readonly string[];
  env?: Readonly<Record<string, string>>;
}

export interface CommandResult {
  command: readonly string[];
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
}

export interface StartedCommand {
  command: readonly string[];
  hasExited(): boolean;
  output(): string;
  kill(): Promise<void>;
}

export interface TestImage {
  tag: string;
  components: readonly ComponentImage[];
}

export interface WorkspaceConfig {
  image: string;
  remoteEnv?: Readonly<Record<string, string>>;
}

const workspaceAt = (root: string, name: string): Workspace => {
  const directory = `workspace-${name}`;
  return { path: path.join(root, directory), containerPath: posix.join("/workspaces", directory) };
};

export const imagesModes = ["build", "pull"] as const;
export type ImagesMode = (typeof imagesModes)[number];

export interface ProvisionOptions {
  images: ImagesMode;
  channel: string;
  prefix: string;
  force: boolean;
}

const provisionComponent = async (
  { component, version, ref }: ComponentImage,
  options: ProvisionOptions,
): Promise<void> => {
  if (options.images === "pull") {
    await project$$`docker pull ${ref}`;
    return;
  }
  const args = [...["--component", component], ...["--version", version], ...(options.force ? ["--force"] : [])];
  await project$$`tsx scripts/tasks/features/dotnet/fetchPayload.ts ${args}`;
  await project$$`tsx scripts/tasks/features/dotnet/buildImage.ts ${[
    ...args,
    ...["--channel", options.channel],
    ...["--prefix", options.prefix],
  ]}`;
};

const provision = async (components: readonly ComponentImage[], options: ProvisionOptions): Promise<void> => {
  if (options.images === "pull") {
    await login(options.prefix);
  }
  for (const component of components) {
    await provisionComponent(component, options);
  }
  const inspect = await $$docker`docker image inspect ${baseImage}`;
  if (inspect.exitCode !== 0) {
    await project$$`docker pull ${baseImage}`;
  }
};

const testImageBuild = (image: TestImage): { dockerfile: string; args: string[] } => {
  const [only] = image.components;
  if (image.components.length === 1) {
    return { dockerfile: "test-image.Dockerfile", args: [`DOTNET_IMAGE_REF=${only.ref}`] };
  }
  return {
    dockerfile: "test-image-multi.Dockerfile",
    args: image.components.map(({ component, ref }) => `DOTNET_${component.toUpperCase()}_IMAGE_REF=${ref}`),
  };
};

const buildTestImage = async (ctxPath: string, image: TestImage): Promise<void> => {
  const { dockerfile, args } = testImageBuild(image);
  await mkdir(ctxPath, { recursive: true });
  await project$$`docker buildx build ${[
    "--network=none",
    "--load",
    ...["--tag", image.tag],
    ...["--file", path.join(import.meta.dirname, dockerfile)],
    ...args.flatMap((arg) => ["--build-arg", arg]),
    ctxPath,
  ]}`;
};

const createWorkspace = async (workspace: Workspace, config: WorkspaceConfig): Promise<void> => {
  const devcontainerPath = path.join(workspace.path, ".devcontainer");
  await mkdir(devcontainerPath, { recursive: true });
  const data = {
    image: config.image,
    features: { "./features": {}, "./user-init": {} },
    remoteUser,
    containerUser: remoteUser,
    runArgs: ["--network=none"],
    remoteEnv: {
      DOTNET_NOLOGO: "1",
      DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK: "1",
      ...config.remoteEnv,
    },
  };
  await writeFile(path.join(devcontainerPath, "devcontainer.json"), `${JSON.stringify(data, null, 2)}\n`);
};

const buildContainer = async (workspace: Workspace): Promise<void> => {
  await project$$`devcontainer build ${["--workspace-folder", workspace.path]}`;
};

const startContainer = async (workspace: Workspace): Promise<void> => {
  await project$$`devcontainer up ${["--remove-existing-container", ...["--workspace-folder", workspace.path]]}`;
};

const execInContainer = async (workspace: Workspace, command: Command): Promise<CommandResult> => {
  const env = Object.entries(command.env ?? {}).flatMap(([name, value]) => ["--remote-env", `${name}=${value}`]);
  const result = await $$exec`devcontainer exec ${["--workspace-folder", workspace.path]} ${env} ${command.command}`;
  return { command: command.command, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
};

const startInContainer = (workspace: Workspace, command: readonly string[]): StartedCommand => {
  const child = $$exec`devcontainer exec ${["--workspace-folder", workspace.path]} ${command}`;
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  return {
    command,
    hasExited: () => child.nodeChildProcess.exitCode !== null || child.nodeChildProcess.signalCode !== null,
    output: () => output.join(""),
    kill: async () => {
      child.kill();
      await child;
    },
  };
};

const removeContainer = async (workspace: Workspace): Promise<void> => {
  const filter = `label=devcontainer.config_file=${path.join(workspace.path, ".devcontainer/devcontainer.json")}`;
  const { stdout } = await $$docker`docker ps -a ${[...["--filter", filter], ...["--format", "{{.ID}}"]]}`;
  const ids = [...new Set(stdout.split("\n").filter(Boolean))];
  if (ids.length > 0) {
    await $$docker`docker rm --force ${ids}`;
  }
};

const removeImage = async (tag: string): Promise<void> => {
  const inspect = await $$docker`docker image inspect ${tag}`;
  if (inspect.exitCode !== 0) {
    return;
  }
  await project$$`docker image rm ${tag}`;
};

export const lifecycle = {
  provision,
  buildTestImage,
  createWorkspace,
  workspaceAt,
  buildContainer,
  startContainer,
  execInContainer,
  startInContainer,
  removeContainer,
  removeImage,
} as const;
