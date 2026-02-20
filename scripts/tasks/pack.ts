import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { artifactsPath, projectRoot } from "@/scripts/project.js";
import { createDevContainerRunner } from "@/scripts/runner.js";

export const pack = async () => {
  const featuresPath = path.resolve(projectRoot, ".devcontainer/features/src");
  const dotConfigSourcePath = path.resolve(featuresPath, "dot-config");
  await rm(artifactsPath, { recursive: true, force: true });
  await mkdir(artifactsPath, { recursive: true });
  await cp(featuresPath, artifactsPath, {
    recursive: true,
    filter: (src) => {
      if (path.basename(src) === "node_modules") {
        return false;
      }
      if (src === dotConfigSourcePath) {
        return false;
      }
      return true;
    },
  });

  // Copy dot-config files
  const dotConfigTargetPath = path.resolve(artifactsPath, "dot-config");
  const fileMap = {
    "devcontainer-feature.json": "devcontainer-feature.json",
    "install.dist.sh": "install.sh",
    "README.md": "README.md",
  };
  await mkdir(dotConfigTargetPath, { recursive: true });
  for (const [sourceFile, targetFile] of Object.entries(fileMap)) {
    await cp(path.resolve(dotConfigSourcePath, sourceFile), path.resolve(dotConfigTargetPath, targetFile));
  }
  await using runner = await createDevContainerRunner();
  await runner.start();
  await runner.exec("mkdir", "--parents", path.resolve(projectRoot, "artifacts"));
  await runner.exec(
    "cp",
    "--recursive",
    "/usr/local/devcontainer-config/dot-config",
    path.resolve(projectRoot, "artifacts"),
  );
  await cp(path.resolve(runner.workspaceFolder, "artifacts/dot-config"), path.resolve(dotConfigTargetPath, "dist"), {
    recursive: true,
    verbatimSymlinks: true,
  });
};
