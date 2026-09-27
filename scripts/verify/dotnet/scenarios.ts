import path from "node:path";

import type { Component } from "@/scripts/tasks/features/dotnet/generateConfig.js";

import type { Expectation } from "./assertions.js";
import type { TestImage, Workspace } from "./lifecycle.js";
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
  workspace: Workspace;
}

interface ScenarioDefinition {
  components: readonly Component[];
  assets: readonly string[];
  directories: readonly string[];
  app?: AppName;
}

export interface Scenario extends ScenarioDefinition {
  name: ScenarioName;
  workspace: Workspace;
  testImage: TestImage;
  execs: readonly Exec[];
  remoteEnv?: Readonly<Record<string, string>>;
  serve?: Serve;
}

export interface BuildStage {
  testImage: TestImage;
  publishes: readonly Exec[];
}

interface ScenarioBehavior {
  execs: readonly Exec[];
  remoteEnv?: Readonly<Record<string, string>>;
  serve?: Serve;
}

const testImagePrefix = "features-verify-dotnet";

const definitions: Record<ScenarioName, ScenarioDefinition> = {
  sdk: { components: ["sdk"], assets: ["hello.cs", "tool"], directories: ["pushed"] },
  runtime: { components: ["runtime"], assets: [], directories: [], app: "console" },
  aspnet: { components: ["aspnet"], assets: [], directories: [], app: "web" },
  multi: { components: ["sdk", "runtime", "aspnet"], assets: [], directories: [] },
};

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
  ],
});

const runtimeBehavior = (): ScenarioBehavior => ({
  execs: [{ command: ["dotnet", "app/console.dll"], expect: { stdout: ["console-ok"] } }],
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

const testImageOf = (name: ScenarioName, selection: Selection): TestImage => {
  const components = definitions[name].components.map((component) => selection.components[component]);
  const [label] = components;
  if (label === undefined) {
    throw new Error(`Scenario ${name} declares no components`);
  }
  return { tag: `${testImagePrefix}:${name}-${label.version}`, components };
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
