import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { linkTree } from "@/scripts/tasks/features/linkTree.js";

import type { DockerArch } from "./architecture.js";
import type { Feature } from "./feature.js";
import { contextPath, payloadPath } from "./paths.js";

export const assembleBuildContext = async (
  feature: Feature,
  component: string,
  key: string,
  arches: readonly DockerArch[],
  featureBinaries: Partial<Record<DockerArch, string>>,
): Promise<string> => {
  const stage = feature.stage(component, key);
  const context = contextPath(feature.id, component, key);
  await rm(context, { recursive: true, force: true });
  await mkdir(path.join(context, "docker"), { recursive: true });
  await copyFile(
    path.join(projectRoot, "features", feature.id, "Dockerfile"),
    path.join(context, "docker", "Dockerfile"),
  );
  for (const arch of arches) {
    const stagedRoot = path.join(context, "linux", arch, "features", feature.id);
    const staged = path.join(stagedRoot, ...stage.subdir);
    await mkdir(staged, { recursive: true });
    await linkTree(payloadPath(feature.id, component, key, arch), staged);
    for (const file of stage.files) {
      await copyFile(path.join(projectRoot, "features", feature.id, file), path.join(stagedRoot, file));
    }
    if (stage.binary) {
      const featureBinary = featureBinaries[arch];
      if (featureBinary === undefined) {
        throw new Error(`No ${feature.id} Feature binary for ${arch}`);
      }
      await copyFile(featureBinary, path.join(stagedRoot, "Feature"));
    }
  }
  return context;
};
