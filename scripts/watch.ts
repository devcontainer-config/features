import { program } from "@commander-js/extra-typings";
import { $ } from "execa";

import { projectRoot } from "@/scripts/project.js";
import { eslintWatch } from "@/scripts/tasks/eslint.js";

program.option("--detach").action(async ({ detach }) => {
  if (detach) {
    const childProcess = $({ detached: true, stdio: "ignore", cwd: projectRoot })`pnpm watch`;
    childProcess.unref();
  } else {
    await eslintWatch();
  }
});

await program.parseAsync();
