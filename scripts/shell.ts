import type { Options } from "execa";
import { $ } from "execa";

import { workspaces } from "@/scripts/project.js";

export const shellOptions: Options = { stdio: "inherit", verbose: true, cwd: workspaces };

export const $$ = $(shellOptions);
