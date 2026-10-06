import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { $ } from "execa";

import { projectRoot } from "@/scripts/project.js";
import { project$$ } from "@/scripts/shell.js";
import { login } from "@/scripts/tasks/features/registry.js";

const baseImage = "mcr.microsoft.com/devcontainers/base:debian";
const remoteUser = "verify";
export const testImagePrefix = "features-verify-ripgrep";

const $$docker = $({ reject: false, stdin: "ignore", stderr: "ignore" });
const $$capture = $({ reject: false, stdio: ["ignore", "pipe", "pipe"], verbose: "full", cwd: projectRoot });

export interface Workspace {
  path: string;
  containerPath: string;
}

export interface Command {
  command: readonly string[];
}

export interface CommandResult {
  command: readonly string[];
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
}

export interface WorkspaceConfig {
  image: string;
}

const workspaceAt = (root: string, name: string): Workspace => {
  const directory = `workspace-${name}`;
  return { path: path.join(root, directory), containerPath: posix.join("/workspaces", directory) };
};

const workspaceImageName = (workspace: Workspace): string => {
  const folderHash = createHash("sha256").update(workspace.path).digest("hex");
  return `vsc-${path.basename(workspace.path)}-${folderHash}`;
};

const workspaceImages = async (workspace: Workspace): Promise<string[]> => {
  const name = workspaceImageName(workspace);
  const { stdout } = await $$docker`docker images ${["--format", "{{.Repository}}:{{.Tag}}"]}`;
  return stdout.split("\n").filter((tag) => tag.startsWith(name));
};

export const imagesModes = ["build", "pull"] as const;
export type ImagesMode = (typeof imagesModes)[number];

export interface ProvisionOptions {
  images: ImagesMode;
  version: string;
  ref: string;
  channel: string;
  prefix: string;
  force: boolean;
}

const provision = async (options: ProvisionOptions): Promise<void> => {
  if (options.images === "pull") {
    await login(options.prefix);
    await project$$`docker pull ${options.ref}`;
  } else {
    await project$$`tsx scripts/tasks/features/ripgrep/fetchPayload.ts ${[
      ...["--version", options.version],
      ...(options.force ? ["--force"] : []),
    ]}`;
    await project$$`tsx scripts/tasks/features/ripgrep/buildImage.ts ${[
      ...["--version", options.version],
      ...["--channel", options.channel],
      ...["--prefix", options.prefix],
    ]}`;
  }
  const inspect = await $$docker`docker image inspect ${baseImage}`;
  if (inspect.exitCode !== 0) {
    await project$$`docker pull ${baseImage}`;
  }
};

const buildTestImage = async (ctxPath: string, version: string, ref: string): Promise<void> => {
  await mkdir(ctxPath, { recursive: true });
  await project$$`docker buildx build ${[
    "--network=none",
    "--load",
    ...["--tag", `${testImagePrefix}:${version}`],
    ...["--file", path.join(import.meta.dirname, "test-image.Dockerfile")],
    ...["--build-arg", `RIPGREP_IMAGE_REF=${ref}`],
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
  };
  await writeFile(path.join(devcontainerPath, "devcontainer.json"), `${JSON.stringify(data, null, 2)}\n`);
};

const buildContainer = async (workspace: Workspace): Promise<void> => {
  await project$$`devcontainer build ${["--workspace-folder", workspace.path]}`;
};

const startContainer = async (workspace: Workspace): Promise<void> => {
  await project$$`devcontainer up ${["--remove-existing-container", ...["--workspace-folder", workspace.path]]}`;
  if ((await workspaceImages(workspace)).length === 0) {
    throw new Error(
      `devcontainer up ${workspace.path}: no images matching ${workspaceImageName(workspace)}*; the devcontainer CLI folder image naming may have changed`,
    );
  }
};

const execInContainer = async (workspace: Workspace, command: Command): Promise<CommandResult> => {
  const result = await $$capture`devcontainer exec ${["--workspace-folder", workspace.path]} ${command.command}`;
  return { command: command.command, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
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

const removeWorkspaceImages = async (workspace: Workspace): Promise<void> => {
  const tags = await workspaceImages(workspace);
  if (tags.length > 0) {
    await project$$`docker image rm ${tags}`;
  }
};

export const lifecycle = {
  provision,
  buildTestImage,
  createWorkspace,
  workspaceAt,
  buildContainer,
  startContainer,
  execInContainer,
  removeContainer,
  removeImage,
  removeWorkspaceImages,
} as const;
