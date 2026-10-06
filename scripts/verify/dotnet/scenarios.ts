// spell-checker:ignore compinit
import path from "node:path";

import type { Component } from "@/scripts/tasks/features/dotnet/generateConfig.js";

import type { Expectation } from "./assertions.js";
import type { TestImage, Workspace } from "./lifecycle.js";
import { lifecycle } from "./lifecycle.js";
import type { Selection } from "./selection.js";
import type { Serve } from "./serve.js";

const names = ["sdk", "runtime", "aspnet", "multi"] as const;
export type ScenarioName = (typeof names)[number];

const appNames = ["console", "web"] as const;
export type AppName = (typeof appNames)[number];

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

interface ScenarioDefinition {
  components: readonly Component[];
  assets: readonly string[];
  directories: readonly string[];
  app?: AppName;
}

type ScenarioVariantDefinition = {
  name: string;
  dockerfile?: string;
  files?: readonly string[];
  skipWorkloadIntegrityCheck?: boolean;
} & ({ execs: readonly Exec[] } | { buildFailure: string });

export type ScenarioVariant = {
  name: string;
  workspace: Workspace;
  testImage: TestImage;
  skipWorkloadIntegrityCheck?: boolean;
} & ({ execs: readonly Exec[] } | { buildFailure: string });

export interface Scenario extends ScenarioDefinition {
  name: ScenarioName;
  workspace: Workspace;
  testImage: TestImage;
  execs: readonly Exec[];
  remoteEnv?: Readonly<Record<string, string>>;
  serve?: Serve;
  variants: readonly ScenarioVariant[];
}

export interface BuildStage {
  testImage: TestImage;
  publishes: readonly Exec[];
}

interface ScenarioBehavior {
  execs: readonly Exec[];
  remoteEnv?: Readonly<Record<string, string>>;
  serve?: Serve;
  variants?: readonly ScenarioVariantDefinition[];
}

const testImagePrefix = "features-verify-dotnet";

const definitions: Record<ScenarioName, ScenarioDefinition> = {
  sdk: { components: ["sdk"], assets: ["hello.cs", "tool"], directories: ["pushed"] },
  runtime: { components: ["runtime"], assets: [], directories: [], app: "console" },
  aspnet: { components: ["aspnet"], assets: [], directories: [], app: "web" },
  multi: { components: ["sdk", "runtime", "aspnet"], assets: [], directories: [] },
};

const completionFiles = [
  "/usr/local/share/bash-completion/completions/dotnet",
  "/usr/local/share/zsh/site-functions/_dotnet",
  "/usr/local/share/fish/vendor_completions.d/dotnet.fish",
];

const completionsPresent: Exec = {
  command: ["sh", "-c", `for file in ${completionFiles.join(" ")}; do test -s "$file" || exit 1; done; echo present`],
  expect: { stdout: ["present"] },
};

const completionsAbsent: Exec = {
  command: ["sh", "-c", `for file in ${completionFiles.join(" ")}; do test ! -e "$file" || exit 1; done; echo absent`],
  expect: { stdout: ["absent"] },
};

const bashCompletionRegistration: Exec = {
  command: [
    "bash",
    "-lc",
    "source /usr/share/bash-completion/bash_completion; _completion_loader dotnet; complete -p dotnet",
  ],
  expect: { stdout: ["complete -F _dotnet dotnet"] },
};

const zshCompletionRegistration: Exec = {
  command: ["zsh", "-f", "-c", "autoload -Uz compinit; compinit -D; print -r -- ${_comps[dotnet]:-NONE}"],
  expect: { stdout: ["_dotnet"] },
};

const installResidue: Exec = {
  command: [
    "sh",
    "-c",
    "test ! -e /opt/dotnet/metadata && test ! -e /root/.dotnet && test ! -e /root/.local/share/NuGet && test ! -e /root/.nuget && echo clean",
  ],
  expect: { stdout: ["clean"] },
};

const tmpPreserved: Exec = {
  command: ["sh", "-c", '[ "$(stat -c %a /tmp)" = 1777 ] && echo preserved'],
  expect: { stdout: ["preserved"] },
};

const sdkVariants: readonly ScenarioVariantDefinition[] = [
  {
    name: "notice",
    skipWorkloadIntegrityCheck: false,
    execs: [
      {
        command: [
          "bash",
          "-lc",
          "grep -qxF 'export DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK=true' /etc/profile.d/dotnet.sh",
        ],
        expect: { stdout: [] },
      },
      {
        command: ["bash", "-lc", "dotnet nuget locals all --list > /dev/null"],
        env: { XDG_DATA_HOME: "/tmp/notice-xdg" },
        expect: { stdout: [] },
      },
    ],
  },
  {
    name: "options-off",
    dockerfile: "test-image-options-off.Dockerfile",
    files: ["options-off.json"],
    execs: [completionsAbsent],
  },
  {
    name: "options-malformed",
    dockerfile: "test-image-options-malformed.Dockerfile",
    files: ["options-malformed.json"],
    buildFailure:
      "install: /opt/devcontainer-config/features/dotnet/options.json: The JSON value could not be converted to DevcontainerConfig.Dotnet.Options. Path: $.tabCompletions | LineNumber: 0 | BytePositionInLine: 25.",
  },
];

const sdkBehavior = ({ selection, workspace }: ScenarioContext): ScenarioBehavior => ({
  execs: [
    { command: ["dotnet", "--version"], expect: { stdout: [selection.components.sdk.version] } },
    { command: ["dotnet", "run", "--file", "hello.cs"], expect: { stdout: ["file-based-ok"] } },
    {
      command: [
        ...["dotnet", "pack", "tool/hello-tool.csproj"],
        ...["--configuration", "Release"],
        ...["--output", "nuget"],
        ...["--verbosity", "quiet"],
      ],
      env: { DefaultTargetFramework: selection.tfm },
      expect: { stdout: [] },
    },
    {
      command: [...["dotnet", "tool", "install"], ...["--global", "hello-tool"], ...["--source", "nuget"]],
      expect: {
        stdout: [
          "You can invoke the tool using the following command: hello-tool",
          "Tool 'hello-tool' (version '1.0.0') was successfully installed.",
        ],
      },
    },
    { command: ["hello-tool"], expect: { stdout: ["hello-tool-ok"] } },
    {
      command: [...["dotnet", "nuget", "locals", "global-packages"], "--list"],
      expect: { stdout: [`global-packages: ${selection.globalPackagesPath}`] },
    },
    {
      command: [
        ...["dotnet", "nuget", "push", "nuget/hello-tool.1.0.0.nupkg"],
        ...["--source", `${workspace.containerPath}/pushed`],
      ],
      expect: {
        stdout: [
          `Pushing hello-tool.1.0.0.nupkg to '${workspace.containerPath}/pushed'...`,
          "Your package was pushed.",
        ],
      },
    },
    completionsPresent,
    bashCompletionRegistration,
    zshCompletionRegistration,
    installResidue,
    tmpPreserved,
  ],
  variants: sdkVariants,
});

const runtimeBehavior = (): ScenarioBehavior => ({
  execs: [{ command: ["dotnet", "app/console.dll"], expect: { stdout: ["console-ok"] } }, completionsAbsent],
});

const aspnetBehavior = ({ workspace }: ScenarioContext): ScenarioBehavior => ({
  execs: [],
  remoteEnv: { ASPNETCORE_URLS: `http://unix:${workspace.containerPath}/app.sock` },
  serve: {
    command: ["dotnet", "app/web.dll"],
    socketPath: path.join(workspace.path, "app.sock"),
    expectedBody: "web-ok",
  },
});

const multiBehavior = ({ selection }: ScenarioContext): ScenarioBehavior => ({
  execs: [
    {
      command: ["dotnet", "--list-sdks"],
      expect: { stdout: [`${selection.components.sdk.version} [/opt/dotnet/sdk]`] },
    },
    {
      command: ["dotnet", "--list-runtimes"],
      expect: {
        stdout: [
          `Microsoft.AspNetCore.App ${selection.components.aspnet.version} [/opt/dotnet/shared/Microsoft.AspNetCore.App]`,
          `Microsoft.NETCore.App ${selection.components.runtime.version} [/opt/dotnet/shared/Microsoft.NETCore.App]`,
        ],
        sorted: true,
      },
    },
  ],
});

const behaviors: Record<ScenarioName, (context: ScenarioContext) => ScenarioBehavior> = {
  sdk: sdkBehavior,
  runtime: runtimeBehavior,
  aspnet: aspnetBehavior,
  multi: multiBehavior,
};

const appOutput = (app: AppName): string => `out/${app}`;

const testImageOf = (name: ScenarioName, selection: Selection, variant?: string): TestImage => {
  const components = definitions[name].components.map((component) => selection.components[component]);
  const [label] = components;
  if (label === undefined) {
    throw new Error(`Scenario ${name} declares no components`);
  }
  const image = variant === undefined ? name : `${name}-${variant}`;
  return { tag: `${testImagePrefix}:${image}-${label.version}`, components };
};

const materializeVariant = (
  name: ScenarioName,
  definition: ScenarioVariantDefinition,
  context: ScenarioContext,
): ScenarioVariant => {
  const image = testImageOf(name, context.selection, definition.name);
  const variant = {
    name: definition.name,
    workspace: lifecycle.workspaceAt(context.root, `${name}-${definition.name}`),
    testImage: { ...image, dockerfile: definition.dockerfile, files: definition.files },
    skipWorkloadIntegrityCheck: definition.skipWorkloadIntegrityCheck,
  };
  return "buildFailure" in definition
    ? { ...variant, buildFailure: definition.buildFailure }
    : { ...variant, execs: definition.execs };
};

const createScenario = (name: ScenarioName, context: ScenarioContext): Scenario => {
  const behavior = behaviors[name](context);
  return {
    ...definitions[name],
    name,
    workspace: context.workspace,
    testImage: testImageOf(name, context.selection),
    execs: behavior.execs,
    remoteEnv: behavior.remoteEnv,
    serve: behavior.serve,
    variants: (behavior.variants ?? []).map((variant) => materializeVariant(name, variant, context)),
  };
};

const createBuildStage = (apps: readonly AppName[], selection: Selection): BuildStage => ({
  testImage: testImageOf("sdk", selection),
  publishes: apps.map((app) => ({
    command: [
      ...["dotnet", "publish", `${app}/${app}.csproj`],
      ...["--configuration", "Release"],
      ...["--output", appOutput(app)],
      ...["--verbosity", "quiet"],
    ],
    env: { DefaultTargetFramework: selection.tfm },
    expect: { stdout: [] },
  })),
});

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
  apps: appNames,
  appOutput,
  create: createScenario,
  createBuildStage,
  select,
} as const;
