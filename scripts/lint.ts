import { csharpierCheck } from "@/scripts/tasks/csharpier.js";
import { spellCheck } from "@/scripts/tasks/cspell.js";
import { dotnetFormatCheck } from "@/scripts/tasks/dotnetFormat.js";
import { eslint } from "@/scripts/tasks/eslint.js";
import { prettierCheck } from "@/scripts/tasks/prettier.js";
import { syncpackLint } from "@/scripts/tasks/syncpack.js";
import { typeCheck } from "@/scripts/tasks/tsc.js";

await syncpackLint();
await typeCheck();
await eslint();
await prettierCheck();
await dotnetFormatCheck();
await csharpierCheck();
await spellCheck();
