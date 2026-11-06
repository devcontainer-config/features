import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { VerifyOptions } from "./arguments.js";
import type { Expectation } from "./assertions.js";
import { assertions } from "./assertions.js";
import type { TestImage, Workspace } from "./lifecycle.js";
import { lifecycle } from "./lifecycle.js";
import type { Serve } from "./serve.js";
import { serve } from "./serve.js";

export interface Exec {
  command: readonly string[];
  env?: Readonly<Record<string, string>>;
  expect: Expectation;
}

export interface ScenarioWorkspace {
  workspace: Workspace;
  testImage: TestImage;
  remoteEnv?: Readonly<Record<string, string>>;
  stage?: (workspace: Workspace) => Promise<void>;
}

export interface Scenario extends ScenarioWorkspace {
  name: string;
  execs: readonly Exec[];
  restart?: readonly Exec[];
  serve?: Serve;
  variants?: readonly ScenarioVariant[];
}

export type ScenarioVariant = ScenarioWorkspace & { name: string } & (
    { execs: readonly Exec[] } | { buildFailure: string }
  );

export interface Suite extends VerifyOptions {
  name: string;
  create(root: string): readonly Scenario[] | Promise<readonly Scenario[]>;
}

const execAll = async (workspace: Workspace, execs: readonly Exec[]): Promise<void> => {
  for (const exec of execs) {
    assertions.exec(await lifecycle.execInContainer(workspace, exec), exec.expect);
  }
};

const prepareWorkspace = async ({ workspace, testImage, remoteEnv, stage }: ScenarioWorkspace): Promise<void> => {
  await lifecycle.createWorkspace(workspace, testImage.tag, { remoteEnv });
  await stage?.(workspace);
};

const runVariant = async (feature: string, scenario: string, variant: ScenarioVariant): Promise<void> => {
  console.log(`>>> verify ${feature}: scenario ${scenario} variant ${variant.name}`);
  await prepareWorkspace(variant);
  if ("buildFailure" in variant) {
    await lifecycle.expectBuildFailure(variant.workspace, variant.buildFailure);
    return;
  }
  await lifecycle.buildContainer(variant.workspace);
  await lifecycle.startContainer(variant.workspace);
  await execAll(variant.workspace, variant.execs);
};

const runScenario = async (feature: string, scenario: Scenario): Promise<void> => {
  console.log(`>>> verify ${feature}: scenario ${scenario.name}`);
  await prepareWorkspace(scenario);
  await lifecycle.buildContainer(scenario.workspace);
  await lifecycle.startContainer(scenario.workspace);
  await execAll(scenario.workspace, scenario.execs);
  if (scenario.serve !== undefined) {
    const server = lifecycle.startInContainer(scenario.workspace, scenario.serve.command);
    try {
      await serve.assertResponse(server, scenario.serve);
    } finally {
      await server.kill();
    }
  }
  if (scenario.restart !== undefined) {
    console.log(`>>> verify ${feature}: scenario ${scenario.name} restart`);
    await lifecycle.startContainer(scenario.workspace);
    await execAll(scenario.workspace, scenario.restart);
  }
  for (const variant of scenario.variants ?? []) {
    await runVariant(feature, scenario.name, variant);
  }
};

export const runSuite = async (suite: Suite): Promise<void> => {
  const tempPath = await mkdtempDisposable(path.join(tmpdir(), `devcontainer-verify-${suite.name}-`));
  const workspaces: Workspace[] = [];
  const testImages = new Map<string, TestImage>();
  try {
    const scenarios = await suite.create(tempPath.path);
    for (const scenario of scenarios) {
      for (const { workspace, testImage } of [scenario, ...(scenario.variants ?? [])]) {
        workspaces.push(workspace);
        testImages.set(testImage.tag, testImage);
      }
    }
    console.log(`>>> verify ${suite.name}: provision`);
    await lifecycle.provision(
      suite.name,
      [...testImages.values()].flatMap((image) => image.components),
      suite,
    );
    console.log(`>>> verify ${suite.name}: test images`);
    for (const image of testImages.values()) {
      await lifecycle.buildTestImage(tempPath.path, image);
    }
    for (const scenario of scenarios) {
      await runScenario(suite.name, scenario);
    }
  } finally {
    console.log(`>>> verify ${suite.name}: cleanup`);
    for (const workspace of workspaces) {
      await lifecycle.removeContainer(workspace);
      await lifecycle.removeWorkspaceImages(workspace);
    }
    if (suite.rmi) {
      for (const tag of testImages.keys()) {
        await lifecycle.removeImage(tag);
      }
    }
    await tempPath.remove();
  }
};
