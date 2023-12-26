import { projectRoot } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

export const prettierCheck = () => $$`prettier --check ${projectRoot}`;

export const prettierFix = () => $$`prettier --write ${projectRoot}`;
