import { spellCheck } from "@/scripts/tasks/cspell.js";
import { eslint } from "@/scripts/tasks/eslint.js";
import { prettierCheck } from "@/scripts/tasks/prettier.js";
import { syncpackLint } from "@/scripts/tasks/syncpack.js";
import { typeCheck } from "@/scripts/tasks/tsc.js";

await syncpackLint();
await typeCheck();
await eslint();
await prettierCheck();
await spellCheck();
