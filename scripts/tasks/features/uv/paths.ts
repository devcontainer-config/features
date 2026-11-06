import path from "node:path";

import { workspaces } from "@/scripts/project.js";

import type { DockerArch, Rid } from "../architecture.js";

export const muslTriples: Record<DockerArch, string> = {
  amd64: "x86_64-unknown-linux-musl",
  arm64: "aarch64-unknown-linux-musl",
};

export const gnuTriples: Record<DockerArch, string> = {
  amd64: "x86_64-unknown-linux-gnu",
  arm64: "aarch64-unknown-linux-gnu",
};

const machines: Record<DockerArch, string> = { amd64: "x86_64", arm64: "aarch64" };

export const machineOf = (arch: DockerArch): string => machines[arch];

export const packPath = (rid: Rid): string => path.join(workspaces, "bin/uv/Feature", rid);
