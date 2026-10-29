import { writeFile } from "node:fs/promises";
import path, { posix } from "node:path";

import type { Expectation } from "./assertions.js";
import type { TestImage, Workspace } from "./lifecycle.js";
import { lifecycle } from "./lifecycle.js";
import type { ComponentImage, Selection } from "./selection.js";

const names = ["binaries", "python", "multi", "download"] as const;
export type ScenarioName = (typeof names)[number];

const testImagePrefix = "features-verify-uv";
const featureDir = "/opt/devcontainer-config/features/uv";
const malformedOptionsMessage =
  "install: /opt/devcontainer-config/features/uv/options.json: The JSON value could not be converted to DevcontainerConfig.Uv.Options. Path: $.defaultPythonVersion | LineNumber: 0 | BytePositionInLine: 27.";

export interface Exec {
  command: readonly string[];
  env?: Readonly<Record<string, string>>;
  expect: Expectation;
}

export interface ScenarioContext {
  selection: Selection;
  root: string;
  workspace: Workspace;
}

export interface ScenarioVariant {
  name: string;
  workspace: Workspace;
  testImage: TestImage;
  buildFailure: string;
}

export interface Scenario {
  name: ScenarioName;
  workspace: Workspace;
  testImage: TestImage;
  execs: readonly Exec[];
  restart?: readonly Exec[];
  remoteEnv?: Readonly<Record<string, string>>;
  downloadMirror?: boolean;
  variants: readonly ScenarioVariant[];
}

interface ScenarioDefinition {
  dockerfile: string;
  argNames: readonly string[];
}

const definitions: Record<ScenarioName, ScenarioDefinition> = {
  binaries: { dockerfile: "test-image.Dockerfile", argNames: ["UV_IMAGE_REF"] },
  python: { dockerfile: "test-image-python.Dockerfile", argNames: ["UV_IMAGE_REF", "UV_PYTHON_IMAGE_REF"] },
  multi: {
    dockerfile: "test-image-multi.Dockerfile",
    argNames: ["UV_IMAGE_REF", "UV_PYTHON_LATEST_IMAGE_REF", "UV_PYTHON_PREVIOUS_IMAGE_REF"],
  },
  download: { dockerfile: "test-image.Dockerfile", argNames: ["UV_IMAGE_REF"] },
};

const componentImages: Record<ScenarioName, (selection: Selection) => ComponentImage[]> = {
  binaries: (selection) => [selection.uv],
  python: (selection) => [selection.uv, selection.python],
  multi: (selection) => [selection.uv, selection.python, selection.previous],
  download: (selection) => [selection.uv],
};

const testImageOf = (name: ScenarioName, selection: Selection, variant?: string): TestImage => {
  const components = componentImages[name](selection);
  const [label] = components;
  if (label === undefined) {
    throw new Error(`Scenario ${name} declares no components`);
  }
  const image = variant === undefined ? name : `${name}-${variant}`;
  return {
    tag: `${testImagePrefix}:${image}-${label.key}`,
    components,
    argNames: definitions[name].argNames,
    dockerfile: definitions[name].dockerfile,
  };
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
  const previous = selection.previous.pythonVersion;
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
  const pythonVersion = selection.previous.pythonVersion;
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

const malformedVariant = (selection: Selection, root: string): ScenarioVariant => ({
  name: "options-malformed",
  workspace: lifecycle.workspaceAt(root, "binaries-options-malformed"),
  testImage: {
    ...testImageOf("binaries", selection, "options-malformed"),
    dockerfile: "test-image-options-malformed.Dockerfile",
    files: [
      { name: "options-malformed.json", source: path.join(import.meta.dirname, "assets", "options-malformed.json") },
    ],
  },
  buildFailure: malformedOptionsMessage,
});

const optionsTestImage = async (
  name: ScenarioName,
  selection: Selection,
  root: string,
  options: Readonly<Record<string, string>>,
): Promise<TestImage> => {
  const source = path.join(root, `${name}-options.json`);
  await writeFile(source, `${JSON.stringify(options)}\n`);
  return { ...testImageOf(name, selection), files: [{ name: "options.json", source }] };
};

const createScenario = async (name: ScenarioName, context: ScenarioContext): Promise<Scenario> => {
  const { selection, root, workspace } = context;
  const remoteEnv = { XDG_BIN_HOME: posix.join(workspace.containerPath, ".bin") };
  switch (name) {
    case "binaries": {
      const testImage = await optionsTestImage(name, selection, root, {});
      return {
        name,
        workspace,
        testImage,
        execs: binariesExecs(selection),
        remoteEnv,
        variants: [malformedVariant(selection, root)],
      };
    }
    case "python": {
      const testImage = await optionsTestImage(name, selection, root, {
        defaultPythonVersion: selection.python.pythonVersion,
      });
      return {
        name,
        workspace,
        testImage,
        execs: pythonExecs(selection),
        restart: pythonRestartExecs(selection),
        remoteEnv,
        variants: [],
      };
    }
    case "multi":
      return {
        name,
        workspace,
        testImage: testImageOf(name, selection),
        execs: multiExecs(selection),
        remoteEnv,
        variants: [],
      };
    case "download": {
      const testImage = await optionsTestImage(name, selection, root, {
        defaultPythonVersion: minorOf(selection.previous.pythonVersion),
      });
      return {
        name,
        workspace,
        testImage,
        execs: downloadExecs(selection),
        remoteEnv: {
          ...remoteEnv,
          UV_PYTHON_INSTALL_MIRROR: `file://${workspace.containerPath}/mirror`,
          UV_PYTHON_DOWNLOADS_JSON_URL: `${workspace.containerPath}/downloads.json`,
        },
        downloadMirror: true,
        variants: [],
      };
    }
  }
};

const select = (values: readonly string[]): ScenarioName[] => {
  if (values.length === 0) {
    return [...names];
  }
  const selected = values.map((value) => {
    const name = names.find((candidate) => candidate === value);
    if (name === undefined) {
      throw new Error(`--scenario must be one of: ${names.join(", ")}`);
    }
    return name;
  });
  return names.filter((name) => selected.includes(name));
};

export const scenarios = {
  create: createScenario,
  select,
} as const;
