import { cp, rm } from "node:fs/promises";
import path from "node:path";

import { artifactsPath, projectRoot } from "@/scripts/project.js";
import { createDevContainerRunner } from "@/scripts/runner.js";
import { $$ } from "@/scripts/shell.js";
import { pack } from "@/scripts/tasks/pack.js";

if (process.env.DEVCONTAINER_TEST) {
  // Run tests in a nested dev container with prebuilt features.
  const tag = "devcontainer";
  await $$`docker build --tag ${tag} ${path.resolve(projectRoot, ".devcontainer")}`;
  await $$`devcontainer features test ${[
    "--project-folder",
    path.resolve(projectRoot, ".devcontainer/features"),
    "--base-image",
    tag,
  ]}`;
} else {
  // Launch a nested dev container with prebuilt features.
  console.log("packing features...");
  await pack();

  await using runner = await createDevContainerRunner({ DEVCONTAINER_TEST: "1" });
  const featuresSrcPath = path.resolve(runner.workspaceFolder, ".devcontainer/features/src");
  await rm(featuresSrcPath, { recursive: true });
  await cp(artifactsPath, featuresSrcPath, { recursive: true, verbatimSymlinks: true });
  await runner.start();
  await runner.exec("pnpm", "test");
}
