import path from "node:path";

import { projectRoot, workspaces } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

const gitignorePath = path.resolve(workspaces, ".gitignore");

export const prettierCheck = () => $$`prettier --check --ignore-path ${gitignorePath} ${projectRoot}`;

export const prettierFix = () => $$`prettier --write --ignore-path ${gitignorePath} ${projectRoot}`;
