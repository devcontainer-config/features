// spell-checker:ignore compinit
import path from "node:path";

import { z } from "zod";

import type { Component } from "@/scripts/tasks/features/dotnet/generateConfig.js";

import { selectionSchema } from "../arguments.js";
import type { ComponentImage, TestImage, Workspace } from "../lifecycle.js";
import { lifecycle } from "../lifecycle.js";
import type { Exec, Scenario, ScenarioVariant } from "../run.js";
import type { Serve } from "../serve.js";
import type { Selection, SelectionTarget } from "./selection.js";
import { staging } from "./staging.js";

const names = ["sdk", "runtime", "aspnet", "multi", "smoke"] as const;
type ScenarioName = (typeof names)[number];
type ImageScenarioName = Exclude<ScenarioName, "smoke">;

export const scenarioSelectionSchema = selectionSchema(
  z.enum(names),
  names,
  names.filter((name) => name !== "smoke"),
);

type AppName = "console" | "web";

const testImagePrefix = "features-verify-dotnet";

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

interface ScenarioContext {
  selection: Selection;
  target: SelectionTarget | undefined;
  root: string;
  workspace: Workspace;
  build: Workspace | undefined;
}

interface ScenarioBehavior {
  execs: readonly Exec[];
  remoteEnv?: Readonly<Record<string, string>>;
  serve?: Serve;
  variants?: readonly ScenarioVariantDefinition[];
}

const definitions: Record<ImageScenarioName, ScenarioDefinition> = {
  sdk: { components: ["sdk"], assets: ["hello.cs", "tool"], directories: ["pushed"] },
  runtime: { components: ["runtime"], assets: [], directories: [], app: "console" },
  aspnet: { components: ["aspnet"], assets: [], directories: [], app: "web" },
  multi: { components: ["sdk", "runtime", "aspnet"], assets: [], directories: [] },
};

const remoteEnvOf = (
  skipWorkloadIntegrityCheck = true,
  extra: Readonly<Record<string, string>> = {},
): Readonly<Record<string, string>> => ({
  DOTNET_NOLOGO: "1",
  ...(skipWorkloadIntegrityCheck ? { DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK: "1" } : {}),
  ...extra,
});

const componentsOf = (name: ImageScenarioName, selection: Selection): ComponentImage[] =>
  definitions[name].components.map((component) => selection.components[component]);

type ComponentArg = readonly [string, ComponentImage];

const testImageOf = (name: string, components: readonly ComponentImage[], variant?: string): TestImage => {
  const [label] = components;
  if (label === undefined) {
    throw new Error(`The ${name} test image declares no components`);
  }
  const componentArgs: readonly ComponentArg[] =
    components.length === 1
      ? [["DOTNET_IMAGE_REF", label]]
      : components.map((component) => [`DOTNET_${component.component.toUpperCase()}_IMAGE_REF`, component]);
  return {
    tag: `${testImagePrefix}:${variant === undefined ? name : `${name}-${variant}`}-${label.key}`,
    components,
    dockerfile: path.join(
      import.meta.dirname,
      componentArgs.length === 1 ? "test-image.Dockerfile" : "test-image-multi.Dockerfile",
    ),
    args: componentArgs.map(([arg, component]) => `${arg}=${component.ref}`),
  };
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
    { command: ["dotnet", "--version"], expect: { stdout: [selection.components.sdk.key] } },
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
  remoteEnv: remoteEnvOf(true, { ASPNETCORE_URLS: `http://unix:${workspace.containerPath}/app.sock` }),
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
      expect: { stdout: [`${selection.components.sdk.key} [/opt/dotnet/sdk]`] },
    },
    {
      command: ["dotnet", "--list-runtimes"],
      expect: {
        stdout: [
          `Microsoft.AspNetCore.App ${selection.components.aspnet.key} [/opt/dotnet/shared/Microsoft.AspNetCore.App]`,
          `Microsoft.NETCore.App ${selection.components.runtime.key} [/opt/dotnet/shared/Microsoft.NETCore.App]`,
        ],
        sorted: true,
      },
    },
  ],
});

const behaviors: Record<ImageScenarioName, (context: ScenarioContext) => ScenarioBehavior> = {
  sdk: sdkBehavior,
  runtime: runtimeBehavior,
  aspnet: aspnetBehavior,
  multi: multiBehavior,
};

const appOutput = (app: AppName): string => `out/${app}`;

const appOf = (selected: readonly ScenarioName[]): AppName[] => [
  ...new Set(
    selected.flatMap((name) => {
      if (name === "smoke") {
        return [];
      }
      const { app } = definitions[name];
      return app === undefined ? [] : [app];
    }),
  ),
];

const variantImage = (
  name: ImageScenarioName,
  definition: ScenarioVariantDefinition,
  context: ScenarioContext,
): TestImage => {
  const image = testImageOf(name, componentsOf(name, context.selection), definition.name);
  if (definition.dockerfile === undefined) {
    return image;
  }
  if (definitions[name].components.length !== 1) {
    throw new Error(`The ${name} scenario declares ${definition.name} with a dockerfile and multiple components`);
  }
  return {
    ...image,
    dockerfile: path.join(import.meta.dirname, definition.dockerfile),
    files: (definition.files ?? []).map((file) => ({ name: file, source: path.join(import.meta.dirname, file) })),
  };
};

const materializeVariant = (
  name: ImageScenarioName,
  definition: ScenarioVariantDefinition,
  context: ScenarioContext,
): ScenarioVariant => {
  const variant = {
    name: definition.name,
    workspace: lifecycle.workspaceAt(context.root, `${name}-${definition.name}`),
    testImage: variantImage(name, definition, context),
    remoteEnv: remoteEnvOf(definition.skipWorkloadIntegrityCheck),
  };
  return "buildFailure" in definition
    ? { ...variant, buildFailure: definition.buildFailure }
    : { ...variant, execs: definition.execs };
};

const smokeScenario = (context: ScenarioContext): Scenario => {
  const { selection, target, workspace } = context;
  if (target === undefined) {
    throw new Error("The smoke scenario requires a target component and version");
  }
  const image = selection.components[target.component];
  const execs: Exec[] = [];
  switch (image.component) {
    case "sdk":
      execs.push({ command: ["dotnet", "--version"], expect: { stdout: [image.key] } });
      break;
    case "runtime":
      execs.push({
        command: ["dotnet", "--list-runtimes"],
        expect: { stdout: [`Microsoft.NETCore.App ${image.key} [/opt/dotnet/shared/Microsoft.NETCore.App]`] },
      });
      break;
    case "aspnet":
      execs.push({
        command: ["dotnet", "--list-runtimes"],
        expect: {
          stdout: [
            `Microsoft.AspNetCore.App ${image.key} [/opt/dotnet/shared/Microsoft.AspNetCore.App]`,
            `Microsoft.NETCore.App ${image.key} [/opt/dotnet/shared/Microsoft.NETCore.App]`,
          ],
          sorted: true,
        },
      });
      break;
  }
  // The runtime host prints its usage and exits 129 for --help when no SDK is installed;
  // --info is the host command every component answers with exit 0.
  execs.push({ command: ["dotnet", "--info"], expect: { exitCode: 0 } });
  return {
    name: "smoke",
    workspace,
    testImage: testImageOf(`smoke-${image.component}`, [image]),
    execs,
    remoteEnv: remoteEnvOf(),
  };
};

const createScenario = (name: ScenarioName, context: ScenarioContext): Scenario => {
  if (name === "smoke") {
    return smokeScenario(context);
  }
  const definition = definitions[name];
  const behavior = behaviors[name](context);
  return {
    name,
    workspace: context.workspace,
    testImage: testImageOf(name, componentsOf(name, context.selection)),
    execs: behavior.execs,
    remoteEnv: behavior.remoteEnv ?? remoteEnvOf(),
    serve: behavior.serve,
    stage: async (workspace) => {
      await staging.assets(workspace, definition.assets, definition.directories);
      if (definition.app === undefined) {
        return;
      }
      if (context.build === undefined) {
        throw new Error(`The ${name} scenario needs the ${definition.app} app, but no build stage was created`);
      }
      await staging.app(workspace, path.join(context.build.path, appOutput(definition.app)));
    },
    variants: (behavior.variants ?? []).map((variant) => materializeVariant(name, variant, context)),
  };
};

interface BuildStageContext {
  selection: Selection;
  workspace: Workspace;
}

const createBuildStage = (apps: readonly AppName[], { selection, workspace }: BuildStageContext): Scenario => ({
  name: "build",
  workspace,
  testImage: testImageOf("sdk", componentsOf("sdk", selection)),
  execs: apps.map((app) => ({
    command: [
      ...["dotnet", "publish", `${app}/${app}.csproj`],
      ...["--configuration", "Release"],
      ...["--output", appOutput(app)],
      ...["--verbosity", "quiet"],
    ],
    env: { DefaultTargetFramework: selection.tfm },
    expect: { stdout: [] },
  })),
  remoteEnv: remoteEnvOf(),
  stage: (staged) => staging.assets(staged, apps, []),
});

export const scenarios = {
  appOf,
  create: createScenario,
  createBuildStage,
} as const;
