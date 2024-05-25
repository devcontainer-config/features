import { program } from "@commander-js/extra-typings";
import { $ } from "execa";
import winston from "winston";

import { initializeLogger } from "./logging.js";
import { packageJson } from "./package.js";
import { sync } from "./sync.js";
import { watch } from "./watch.js";

await initializeLogger();
const projectRoot = process.cwd();

program.name(packageJson.name).version(packageJson.version);

program
  .command("sync")
  .description("perform a one-time synchronization of .config/ files")
  .action(async () => {
    try {
      await sync(projectRoot);
    } catch (error) {
      winston.error("sync:", error);
    }
  });

program
  .command("watch")
  .description("watch and synchronize for changes to/from .config/ files")
  .option("--detach", "detach from the current process")
  .action(({ detach }) => {
    if (detach) {
      const childProcess = $({ detached: true, stdio: "ignore" })`${packageJson.name} watch`;
      childProcess.unref();
    } else {
      watch(projectRoot);
    }
  });

await program.parseAsync();
