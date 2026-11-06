import { writeFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import type { Component } from "@/scripts/tasks/features/uv/generateConfig.js";

import { selectionSchema } from "../arguments.js";
import type { ComponentImage, TestImage, Workspace } from "../lifecycle.js";
import { lifecycle } from "../lifecycle.js";
import type { Exec, Scenario, ScenarioVariant } from "../run.js";
import type { Selection, SelectionTarget } from "./selection.js";
import { previousOf } from "./selection.js";
import { staging } from "./staging.js";

const names = ["binaries", "python", "multi", "download", "smoke"] as const;
type ScenarioName = (typeof names)[number];

export const scenarioSelectionSchema = selectionSchema(
  z.enum(names),
  names,
  names.filter((name) => name !== "smoke"),
);

const testImagePrefix = "features-verify-uv";
const featureDir = "/opt/devcontainer-config/features/uv";
const malformedOptionsMessage =
  "install: /opt/devcontainer-config/features/uv/options.json: The JSON value could not be converted to DevcontainerConfig.Uv.Options. Path: $.defaultPythonVersion | LineNumber: 0 | BytePositionInLine: 27.";

interface ScenarioContext {
  selection: Selection;
  target: SelectionTarget | undefined;
  root: string;
  workspace: Workspace;
  force: boolean;
}

type ComponentArg = readonly [string, ComponentImage];

const testImage = (
  name: string,
  dockerfile: string,
  componentArgs: readonly ComponentArg[],
  variant?: string,
): TestImage => {
  const [first] = componentArgs;
  if (first === undefined) {
    throw new Error(`The ${name} test image declares no components`);
  }
  const [, label] = first;
  return {
    tag: `${testImagePrefix}:${variant === undefined ? name : `${name}-${variant}`}-${label.key}`,
    components: componentArgs.map(([, component]) => component),
    dockerfile: path.join(import.meta.dirname, dockerfile),
    args: componentArgs.map(([arg, component]) => `${arg}=${component.ref}`),
  };
};

const optionsImage = async (
  name: string,
  root: string,
  image: TestImage,
  options: Readonly<Record<string, string>>,
): Promise<TestImage> => {
  const source = path.join(root, `${name}-options.json`);
  await writeFile(source, `${JSON.stringify(options)}\n`);
  return { ...image, files: [{ name: "options.json", source }] };
};

const minorOf = (pythonVersion: string): string => {
  const [major, minor] = pythonVersion.split(".");
  return `${major}.${minor}`;
};

const pythonKey = (selection: Selection, pythonVersion: string): string =>
  `cpython-${pythonVersion}-linux-${selection.machine}-gnu`;

const pythonPatchDir = (selection: Selection, pythonVersion: string): string =>
  `${selection.xdgDataPath}/uv/python/${pythonKey(selection, pythonVersion)}`;

const pythonMinorDir = (selection: Selection, pythonVersion: string): string =>
  `${selection.xdgDataPath}/uv/python/cpython-${minorOf(pythonVersion)}-linux-${selection.machine}-gnu`;

const pythonExecutable = (selection: Selection, pythonVersion: string): string =>
  `${pythonPatchDir(selection, pythonVersion)}/bin/python${minorOf(pythonVersion)}`;

const pythonListLine = (selection: Selection, pythonVersion: string): string =>
  `${pythonKey(selection, pythonVersion)}    ${pythonMinorDir(selection, pythonVersion)}/bin/python${minorOf(pythonVersion)}`;

const linkTarget = (name: string, target: string): Exec => ({
  command: ["sh", "-c", `readlink -f "$XDG_BIN_HOME/${name}"`],
  expect: { stdout: [target] },
});

const linkVersion = (name: string, pythonVersion: string): Exec => ({
  command: ["sh", "-c", `"$XDG_BIN_HOME/${name}" -V`],
  expect: { stdout: [`Python ${pythonVersion}`] },
});

const completionFiles = [
  "/usr/local/share/bash-completion/completions/uv",
  "/usr/local/share/zsh/site-functions/_uv",
  "/usr/local/share/fish/vendor_completions.d/uv.fish",
  "/usr/local/share/bash-completion/completions/uvx",
  "/usr/local/share/zsh/site-functions/_uvx",
  "/usr/local/share/fish/vendor_completions.d/uvx.fish",
];

const binariesExecs = (selection: Selection): Exec[] => [
  { command: ["uv", "--version"], expect: { stdout: [`uv ${selection.uv.key} (${selection.muslTriple})`] } },
  { command: ["uvx", "--version"], expect: { stdout: [`uvx ${selection.uv.key} (${selection.muslTriple})`] } },
  {
    command: ["sh", "-c", "command -v uv; command -v uvx"],
    expect: { stdout: ["/usr/local/bin/uv", "/usr/local/bin/uvx"] },
  },
  { command: ["stat", "-c", "%a", "/usr/local/bin/uv", "/usr/local/bin/uvx"], expect: { stdout: ["755", "755"] } },
  {
    command: ["sh", "-c", `for file in ${completionFiles.join(" ")}; do test -s "$file" || exit 1; done; echo present`],
    expect: { stdout: ["present"] },
  },
];

const pythonExecs = (selection: Selection): Exec[] => {
  const pythonVersion = selection.python.pythonVersion;
  return [
    { command: ["cat", `${featureDir}/default-python`], expect: { stdout: [pythonVersion] } },
    {
      command: ["uv", "python", "list", "--only-installed"],
      expect: { stdout: [pythonListLine(selection, pythonVersion)] },
    },
    linkTarget("python", pythonExecutable(selection, pythonVersion)),
    linkTarget("python3", pythonExecutable(selection, pythonVersion)),
    linkTarget(`python${minorOf(pythonVersion)}`, pythonExecutable(selection, pythonVersion)),
    linkVersion("python", pythonVersion),
    {
      command: ["uv", "run", "-q", "--no-project", "--python", pythonVersion, "python", "-V"],
      expect: { stdout: [`Python ${pythonVersion}`] },
    },
    { command: ["uv", "venv", "-q", "--python", pythonVersion], expect: { stdout: [] } },
    { command: [".venv/bin/python", "-V"], expect: { stdout: [`Python ${pythonVersion}`] } },
  ];
};

const pythonRestartExecs = (selection: Selection): Exec[] => {
  const pythonVersion = selection.python.pythonVersion;
  return [
    { command: ["cat", `${featureDir}/default-python`], expect: { stdout: [pythonVersion] } },
    {
      command: ["uv", "python", "list", "--only-installed"],
      expect: { stdout: [pythonListLine(selection, pythonVersion)] },
    },
    linkTarget("python", pythonExecutable(selection, pythonVersion)),
    linkTarget("python3", pythonExecutable(selection, pythonVersion)),
    linkTarget(`python${minorOf(pythonVersion)}`, pythonExecutable(selection, pythonVersion)),
    linkVersion("python", pythonVersion),
  ];
};

const multiExecs = (selection: Selection): Exec[] => {
  const latest = selection.python.pythonVersion;
  const previous = previousOf(selection).pythonVersion;
  return [
    {
      command: ["uv", "python", "list", "--only-installed"],
      expect: { stdout: [pythonListLine(selection, latest), pythonListLine(selection, previous)] },
    },
    linkTarget(`python${minorOf(latest)}`, pythonExecutable(selection, latest)),
    linkTarget(`python${minorOf(previous)}`, pythonExecutable(selection, previous)),
    {
      command: ["sh", "-c", 'test ! -e "$XDG_BIN_HOME/python" && test ! -e "$XDG_BIN_HOME/python3" && echo absent'],
      expect: { stdout: ["absent"] },
    },
  ];
};

const downloadExecs = (selection: Selection): Exec[] => {
  const pythonVersion = previousOf(selection).pythonVersion;
  return [
    {
      command: ["uv", "python", "list", "--only-installed"],
      expect: { stdout: [pythonListLine(selection, pythonVersion)] },
    },
    linkTarget("python", pythonExecutable(selection, pythonVersion)),
    linkTarget("python3", pythonExecutable(selection, pythonVersion)),
    linkVersion("python", pythonVersion),
    {
      command: ["uv", "run", "-q", "--no-project", "--python", pythonVersion, "python", "-V"],
      expect: { stdout: [`Python ${pythonVersion}`] },
    },
  ];
};

const smokeExecs = (selection: Selection, component: Component): Exec[] => {
  const execs: Exec[] = [
    { command: ["uv", "--version"], expect: { stdout: [`uv ${selection.uv.key} (${selection.muslTriple})`] } },
    { command: ["uv", "--help"], expect: { exitCode: 0 } },
  ];
  if (component === "python") {
    const pythonVersion = selection.python.pythonVersion;
    execs.push(
      { command: ["sh", "-c", '"$XDG_BIN_HOME/python" -V'], expect: { stdout: [`Python ${pythonVersion}`] } },
      {
        command: ["uv", "python", "list", "--only-installed"],
        expect: { stdout: [pythonListLine(selection, pythonVersion)] },
      },
    );
  }
  return execs;
};

const malformedVariant = (selection: Selection, root: string): ScenarioVariant => ({
  name: "options-malformed",
  workspace: lifecycle.workspaceAt(root, "binaries-options-malformed"),
  testImage: {
    ...testImage(
      "binaries",
      "test-image-options-malformed.Dockerfile",
      [["UV_IMAGE_REF", selection.uv]],
      "options-malformed",
    ),
    files: [
      { name: "options-malformed.json", source: path.join(import.meta.dirname, "assets", "options-malformed.json") },
    ],
  },
  buildFailure: malformedOptionsMessage,
});

const createScenario = async (name: ScenarioName, context: ScenarioContext): Promise<Scenario> => {
  const { selection, target, root, workspace, force } = context;
  const remoteEnv = { XDG_BIN_HOME: posix.join(workspace.containerPath, ".bin") };
  switch (name) {
    case "binaries": {
      const image = testImage(name, "test-image.Dockerfile", [["UV_IMAGE_REF", selection.uv]]);
      return {
        name,
        workspace,
        testImage: await optionsImage(name, root, image, {}),
        execs: binariesExecs(selection),
        remoteEnv,
        variants: [malformedVariant(selection, root)],
      };
    }
    case "python": {
      const image = testImage(name, "test-image-python.Dockerfile", [
        ["UV_IMAGE_REF", selection.uv],
        ["UV_PYTHON_IMAGE_REF", selection.python],
      ]);
      return {
        name,
        workspace,
        testImage: await optionsImage(name, root, image, { defaultPythonVersion: selection.python.pythonVersion }),
        execs: pythonExecs(selection),
        restart: pythonRestartExecs(selection),
        remoteEnv,
      };
    }
    case "multi":
      return {
        name,
        workspace,
        testImage: testImage(name, "test-image-multi.Dockerfile", [
          ["UV_IMAGE_REF", selection.uv],
          ["UV_PYTHON_LATEST_IMAGE_REF", selection.python],
          ["UV_PYTHON_PREVIOUS_IMAGE_REF", previousOf(selection)],
        ]),
        execs: multiExecs(selection),
        remoteEnv,
      };
    case "smoke": {
      if (target === undefined) {
        throw new Error("The smoke scenario requires a target component and version");
      }
      const image = testImage(`smoke-${target.component}`, "test-image-python.Dockerfile", [
        ["UV_IMAGE_REF", selection.uv],
        ["UV_PYTHON_IMAGE_REF", target.component === "python" ? selection.python : selection.uv],
      ]);
      const options: Readonly<Record<string, string>> =
        target.component === "python" ? { defaultPythonVersion: selection.python.pythonVersion } : {};
      return {
        name,
        workspace,
        testImage: await optionsImage(`smoke-${target.component}`, root, image, options),
        execs: smokeExecs(selection, target.component),
        remoteEnv,
      };
    }
    case "download": {
      const image = testImage(name, "test-image.Dockerfile", [["UV_IMAGE_REF", selection.uv]]);
      return {
        name,
        workspace,
        testImage: await optionsImage(name, root, image, {
          defaultPythonVersion: minorOf(previousOf(selection).pythonVersion),
        }),
        execs: downloadExecs(selection),
        remoteEnv: {
          ...remoteEnv,
          UV_PYTHON_INSTALL_MIRROR: `file://${workspace.containerPath}/mirror`,
          UV_PYTHON_DOWNLOADS_JSON_URL: `${workspace.containerPath}/downloads.json`,
        },
        stage: (staged) => staging.downloadMirror(staged, selection, force),
      };
    }
  }
};

export const scenarios = {
  create: createScenario,
} as const;
