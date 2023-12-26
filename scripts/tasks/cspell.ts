import { projectRoot } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

export const spellCheck = () => $$`cspell ${projectRoot}`;
