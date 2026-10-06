import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Component } from "@/scripts/tasks/features/dotnet/generateConfig.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assertions } from "./assertions.js";
import type { TestImage, Workspace } from "./lifecycle.js";
import { imagesModes, lifecycle } from "./lifecycle.js";
import { scenarios } from "./scenarios.js";
import type { ComponentImage } from "./selection.js";
import { selection } from "./selection.js";
import { serve } from "./serve.js";
import { staging } from "./staging.js";

const componentImages = (images: readonly TestImage[]): ComponentImage[] => {
  const byComponent = new Map<Component, ComponentImage>();
  for (const image of images) {
    for (const component of image.components) {
      byComponent.set(component.component, component);
    }
  }
  return [...byComponent.values()];
};

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
    `>>> verify dotnet: selection sdk=${derived.components.sdk.version} runtime=${derived.components.runtime.version} aspnet=${derived.components.aspnet.version} tfm=${derived.tfm}`,
  );

  const tempPath = await mkdtempDisposable(path.join(tmpdir(), "devcontainer-verify-dotnet-"));
  const ctxPath = path.join(tempPath.path, "ctx");
  const runs = selected.map((name) =>
    scenarios.create(name, {
      selection: derived,
      root: tempPath.path,
      workspace: lifecycle.workspaceAt(tempPath.path, name),
    }),
  );
  const variants = runs.flatMap((run) => run.variants);
  const apps = [...new Set(runs.flatMap((run) => (run.app === undefined ? [] : [run.app])))];
  const build =
    apps.length === 0
      ? undefined
      : {
          workspace: lifecycle.workspaceAt(tempPath.path, "build"),
          ...scenarios.createBuildStage(apps, derived),
        };
  const testImages = new Map<string, TestImage>();
  for (const run of runs) {
    testImages.set(run.testImage.tag, run.testImage);
  }
  for (const variant of variants) {
    testImages.set(variant.testImage.tag, variant.testImage);
  }
  if (build !== undefined) {
    testImages.set(build.testImage.tag, build.testImage);
  }
  const workspaces: Workspace[] = [
    ...runs.map((run) => run.workspace),
    ...variants.map((variant) => variant.workspace),
    ...(build === undefined ? [] : [build.workspace]),
  ];

  try {
    console.log(">>> verify dotnet: provision");
    await lifecycle.provision(componentImages([...testImages.values()]), {
      images,
      channel,
      prefix,
      force: values.force,
    });

    console.log(">>> verify dotnet: test images");
    for (const image of testImages.values()) {
      await lifecycle.buildTestImage(ctxPath, image);
    }

    console.log(">>> verify dotnet: workspaces");
    for (const run of runs) {
      await lifecycle.createWorkspace(run.workspace, { image: run.testImage.tag, remoteEnv: run.remoteEnv });
      await staging.features(run.workspace);
      await staging.assets(run.workspace, run.assets, run.directories);
    }
    for (const variant of variants) {
      await lifecycle.createWorkspace(variant.workspace, {
        image: variant.testImage.tag,
        skipWorkloadIntegrityCheck: variant.skipWorkloadIntegrityCheck,
      });
      await staging.features(variant.workspace);
    }
    if (build !== undefined) {
      await lifecycle.createWorkspace(build.workspace, { image: build.testImage.tag });
      await staging.features(build.workspace);
      await staging.assets(build.workspace, scenarios.apps, []);
    }

    if (build !== undefined) {
      console.log(">>> verify dotnet: build stage");
      await lifecycle.buildContainer(build.workspace);
      await lifecycle.startContainer(build.workspace);
      for (const publish of build.publishes) {
        assertions.exec(await lifecycle.execInContainer(build.workspace, publish), publish.expect);
      }
      for (const run of runs) {
        if (run.app !== undefined) {
          await staging.app(run.workspace, path.join(build.workspace.path, scenarios.appOutput(run.app)));
        }
      }
    }

    for (const run of runs) {
      console.log(`>>> verify dotnet: scenario ${run.name}`);
      await lifecycle.buildContainer(run.workspace);
      await lifecycle.startContainer(run.workspace);
      for (const exec of run.execs) {
        assertions.exec(await lifecycle.execInContainer(run.workspace, exec), exec.expect);
      }
      if (run.serve !== undefined) {
        const server = lifecycle.startInContainer(run.workspace, run.serve.command);
        try {
          await serve.assertResponse(server, run.serve);
        } finally {
          await server.kill();
        }
      }
      for (const variant of run.variants) {
        console.log(`>>> verify dotnet: scenario ${run.name} variant ${variant.name}`);
        if ("buildFailure" in variant) {
          await lifecycle.expectBuildFailure(variant.workspace, variant.buildFailure);
          continue;
        }
        await lifecycle.buildContainer(variant.workspace);
        await lifecycle.startContainer(variant.workspace);
        for (const exec of variant.execs) {
          assertions.exec(await lifecycle.execInContainer(variant.workspace, exec), exec.expect);
        }
      }
    }
  } finally {
    console.log(">>> verify dotnet: cleanup");
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
