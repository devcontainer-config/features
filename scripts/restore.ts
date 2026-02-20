import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";
import { build } from "@/scripts/tasks/build.js";

await rm(path.resolve(projectRoot, "node_modules"), { recursive: true, force: true });
await $$`pnpm install`;
await build();
