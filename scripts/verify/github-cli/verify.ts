// spell-checker:ignore compinit
import path from "node:path";

import { z } from "zod";

import { parseVerifyArguments, selectionSchema, targetSchema } from "../arguments.js";
import { lifecycle } from "../lifecycle.js";
import type { Exec } from "../run.js";
import { runSuite } from "../run.js";
import { userInit } from "../userInit.js";
import { selection } from "./selection.js";

const names = ["default", "smoke"] as const;
type ScenarioName = (typeof names)[number];

const scenarioSelectionSchema = selectionSchema(z.enum(names), names, ["default"]);

const targetSchemaForFeature = targetSchema(z.literal("github-cli"));

const testImagePrefix = "features-verify-github-cli";
const testImageDockerfile = path.join(import.meta.dirname, "test-image.Dockerfile");
const featureDir = "/opt/devcontainer-config/features/github-cli";

const completionFiles = [
  "/usr/local/share/bash-completion/completions/gh",
  "/usr/local/share/zsh/site-functions/_gh",
  "/usr/local/share/fish/vendor_completions.d/gh.fish",
];

const bashCompletionRegistration: Exec = {
  command: [
    "bash",
    "-lc",
    "source /usr/share/bash-completion/bash_completion; _completion_loader gh; complete -p gh >/dev/null && echo registered",
  ],
  expect: { stdout: ["registered"] },
};

const zshCompletionRegistration: Exec = {
  command: ["zsh", "-f", "-c", "autoload -Uz compinit; compinit -D; print -r -- ${_comps[gh]:-NONE}"],
  expect: { stdout: ["_gh"] },
};

const defaultExecs = (version: string, residuePaths: readonly string[]): Exec[] => [
  {
    command: ["sh", "-c", "gh --version | awk 'NR == 1 { print $1, $2, $3 }'"],
    expect: { stdout: [`gh version ${version}`] },
  },
  { command: ["gh", "--help"], expect: { exitCode: 0 } },
  {
    command: ["sh", "-c", "command -v gh"],
    expect: { stdout: ["/usr/local/bin/gh"] },
  },
  {
    command: ["readlink", "-f", "/usr/local/bin/gh"],
    expect: { stdout: [`${featureDir}/bin/gh`] },
  },
  {
    command: [
      "sh",
      "-c",
      `diff -r ${featureDir}/share/man/man1 /usr/local/share/man/man1 && cmp ${featureDir}/LICENSE /usr/local/share/doc/gh/LICENSE && echo copied`,
    ],
    expect: { stdout: ["copied"] },
  },
  {
    command: ["sh", "-c", `for file in ${completionFiles.join(" ")}; do test -s "$file" || exit 1; done; echo present`],
    expect: { stdout: ["present"] },
  },
  bashCompletionRegistration,
  zshCompletionRegistration,
  {
    command: ["sh", "-c", "grep -qxF 'export GH_TELEMETRY=false' /etc/profile.d/gh.sh"],
    expect: { stdout: [] },
  },
  {
    command: ["bash", "-lc", 'printf "%s\\n" "${GH_TELEMETRY:-NONE}"'],
    expect: { stdout: ["false"] },
  },
  {
    command: [
      "sh",
      "-c",
      `for target in ${residuePaths.join(" ")}; do test ! -e "$target" || { echo "residue $target"; exit 1; }; done; echo clean`,
    ],
    expect: { stdout: ["clean"] },
  },
];

const smokeExecs = (version: string): Exec[] => [
  {
    command: ["sh", "-c", "gh --version | awk 'NR == 1 { print $1, $2, $3 }'"],
    expect: { stdout: [`gh version ${version}`] },
  },
  {
    command: ["sh", "-c", "command -v gh"],
    expect: { stdout: ["/usr/local/bin/gh"] },
  },
  { command: ["gh", "--help"], expect: { exitCode: 0 } },
];

const execsOf: Record<ScenarioName, (version: string, residuePaths: readonly string[]) => readonly Exec[]> = {
  default: defaultExecs,
  smoke: smokeExecs,
};

export const verify = async (argv: string[]): Promise<void> => {
  const { options, scenarios: requested, component, version } = await parseVerifyArguments(argv);
  const selected = scenarioSelectionSchema.parse(requested);
  const target = targetSchemaForFeature.parse({ component, version });
  const derived = await selection.derive(options.channel, options.prefix, target?.key);
  console.log(`>>> verify github-cli: selection version=${derived.key} ref=${derived.ref}`);

  const residuePaths = [
    "/root/.config/gh",
    "/root/.local/state/gh",
    "/root/.local/share/gh",
    "/root/.cache/gh",
    ...(await Promise.all(
      ["XDG_CONFIG_HOME", "XDG_STATE_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME"].map(async (variable) =>
        path.posix.join(await userInit.xdgPath(variable), "gh"),
      ),
    )),
  ];

  await runSuite({
    ...options,
    name: "github-cli",
    create: (root) =>
      selected.map((name) => ({
        name,
        workspace: lifecycle.workspaceAt(root, name),
        testImage: {
          tag: `${testImagePrefix}:${derived.key}`,
          components: [derived],
          dockerfile: testImageDockerfile,
          args: [`GITHUB_CLI_IMAGE_REF=${derived.ref}`],
        },
        execs: execsOf[name](derived.key, residuePaths),
      })),
  });
};
