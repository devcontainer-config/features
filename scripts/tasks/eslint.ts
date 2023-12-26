import path from "node:path";

import { projectRoot, workspaces } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

const tsConfigPath = path.resolve(projectRoot, ".config/eslint/tsconfig.json");

export const eslintSetup = (watch = false) =>
  $$`tsc --project ${tsConfigPath} --outDir ${workspaces} ${watch ? ["--watch"] : []}`;

export const eslintWatch = () => eslintSetup(true);

export const eslint = async () => $$`eslint ${projectRoot}`;

export const eslintFix = async () => $$`eslint --fix ${projectRoot}`;
