import { csharpierFix } from "@/scripts/tasks/csharpier.js";
import { dotnetFormat } from "@/scripts/tasks/dotnetFormat.js";
import { eslintFix } from "@/scripts/tasks/eslint.js";
import { prettierFix } from "@/scripts/tasks/prettier.js";
import { syncpackFix } from "@/scripts/tasks/syncpack.js";

await syncpackFix();
await eslintFix();
await prettierFix();
await csharpierFix();
await dotnetFormat();
