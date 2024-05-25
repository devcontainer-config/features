import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..");

export const workspaces = path.resolve(projectRoot, "..");
