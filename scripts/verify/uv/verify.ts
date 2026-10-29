import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assertions } from "./assertions.js";
import type { TestImage, Workspace } from "./lifecycle.js";
import { imagesModes, lifecycle } from "./lifecycle.js";
import { scenarios } from "./scenarios.js";
import type { ComponentImage } from "./selection.js";
import { selection } from "./selection.js";
import { staging } from "./staging.js";

const componentImages = (images: readonly TestImage[]): ComponentImage[] => images.flatMap((image) => image.components);

export const verify = async (argv: string[]): Promise<void> => {
  const { values } = parseArgs({
    args: argv,
    options: {
      force: { type: "boolean", default: false },
      rmi: { type: "boolean", default: false },
      scenario: { type: "string", multiple: true },
      images: { type: "string", default: "build" },
      channel: { type: "string", default: mainChannel },
      prefix: { type: "string" },
    },
  });

  const images = imagesModes.find((candidate) => candidate === values.images);
  if (images === undefined) {
    throw new Error(`--images must be one of: ${imagesModes.join(", ")}`);
  }
  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  const selected = scenarios.select(values.scenario ?? []);
  const derived = await selection.derive(channel, prefix);
  console.log(
    `>>> verify uv: selection uv=${derived.uv.key} python=${derived.python.key} previous=${derived.previous.key}`,
  );

  const tempPath = await mkdtempDisposable(path.join(tmpdir(), "devcontainer-verify-uv-"));
  const ctxPath = path.join(tempPath.path, "ctx");
  const runs = await Promise.all(
    selected.map((name) =>
      scenarios.create(name, {
        selection: derived,
        root: tempPath.path,
        workspace: lifecycle.workspaceAt(tempPath.path, name),
      }),
    ),
  );
  const variants = runs.flatMap((run) => run.variants);
  const testImages = new Map<string, TestImage>();
  for (const run of runs) {
    testImages.set(run.testImage.tag, run.testImage);
  }
  for (const variant of variants) {
    testImages.set(variant.testImage.tag, variant.testImage);
  }
  const workspaces: Workspace[] = [
    ...runs.map((run) => run.workspace),
    ...variants.map((variant) => variant.workspace),
  ];

  try {
    console.log(">>> verify uv: provision");
    await lifecycle.provision(componentImages([...testImages.values()]), {
      images,
      channel,
      prefix,
      force: values.force,
    });

    console.log(">>> verify uv: test images");
    for (const image of testImages.values()) {
      await lifecycle.buildTestImage(ctxPath, image);
    }

    console.log(">>> verify uv: workspaces");
    for (const run of runs) {
      await lifecycle.createWorkspace(run.workspace, { image: run.testImage.tag, remoteEnv: run.remoteEnv });
      await staging.features(run.workspace);
      if (run.downloadMirror === true) {
        await staging.downloadMirror(run.workspace, derived, values.force);
      }
    }
    for (const variant of variants) {
      await lifecycle.createWorkspace(variant.workspace, { image: variant.testImage.tag });
      await staging.features(variant.workspace);
    }

    for (const run of runs) {
      console.log(`>>> verify uv: scenario ${run.name}`);
      await lifecycle.buildContainer(run.workspace);
      await lifecycle.startContainer(run.workspace);
      for (const exec of run.execs) {
        assertions.exec(await lifecycle.execInContainer(run.workspace, exec), exec.expect);
      }
      if (run.restart !== undefined) {
        console.log(`>>> verify uv: scenario ${run.name} restart`);
        await lifecycle.startContainer(run.workspace);
        for (const exec of run.restart) {
          assertions.exec(await lifecycle.execInContainer(run.workspace, exec), exec.expect);
        }
      }
      for (const variant of run.variants) {
        console.log(`>>> verify uv: scenario ${run.name} variant ${variant.name}`);
        await lifecycle.expectBuildFailure(variant.workspace, variant.buildFailure);
      }
    }
  } finally {
    console.log(">>> verify uv: cleanup");
    for (const workspace of workspaces) {
      await lifecycle.removeContainer(workspace);
      await lifecycle.removeWorkspaceImages(workspace);
    }
    if (values.rmi) {
      for (const image of testImages.values()) {
        await lifecycle.removeImage(image.tag);
      }
    }
    await tempPath.remove();
  }
};
