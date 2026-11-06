import path from "node:path";

import { workspaces } from "@/scripts/project.js";

import type { DockerArch } from "./architecture.js";

export const payloadPath = (feature: string, component: string, key: string, arch: DockerArch): string =>
  path.join(workspaces, "payload", feature, component, key, arch);

export const contextPath = (feature: string, component: string, key: string): string =>
  path.join(workspaces, "payload", feature, "ctx", component, key);
