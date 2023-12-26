import { build } from "@/scripts/tasks/build.js";
import { eslintSetup } from "@/scripts/tasks/eslint.js";

await build();
await eslintSetup();
