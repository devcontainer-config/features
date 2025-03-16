import { projectRoot } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

export const eslint = async () => $$`eslint ${projectRoot}`;

export const eslintFix = async () => $$`eslint --fix ${projectRoot}`;
