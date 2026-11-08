import { writeFile } from "node:fs/promises";
import path, { posix } from "node:path";

import { z } from "zod";

import { selectionSchema } from "../arguments.js";
import type { TestImage, TestImageFile, Workspace } from "../lifecycle.js";
import { lifecycle } from "../lifecycle.js";
import type { Exec, Scenario, ScenarioVariant } from "../run.js";
import type { Selection, SelectionTarget } from "./selection.js";

const names = ["default", "password", "socket", "args", "smoke"] as const;
type ScenarioName = (typeof names)[number];

export const scenarioSelectionSchema = selectionSchema(
  z.enum(names),
  names,
  names.filter((name) => name !== "smoke"),
);

const testImagePrefix = "features-verify-code-server";
const featureDir = "/opt/devcontainer-config/features/code-server";
const installedDir = `${featureDir}/code-server`;
const nodePath = `${installedDir}/lib/node`;
const postStart = "/opt/devcontainer-config/features-run postStart";

interface ScenarioContext {
  selection: Selection;
  target: SelectionTarget | undefined;
  root: string;
  workspace: Workspace;
}

const testImageOf = (name: string, selection: Selection, files?: readonly TestImageFile[]): TestImage => ({
  tag: `${testImagePrefix}:${name}-${selection.key}`,
  components: [selection],
  dockerfile: path.join(
    import.meta.dirname,
    files === undefined ? "test-image.Dockerfile" : "test-image-options.Dockerfile",
  ),
  args: [`CODE_SERVER_IMAGE_REF=${selection.ref}`],
  files,
});

const optionsImage = async (name: string, root: string, selection: Selection, options: unknown): Promise<TestImage> => {
  const source = path.join(root, `${name}-options.json`);
  await writeFile(source, `${JSON.stringify(options, null, 2)}\n`);
  return testImageOf(name, selection, [{ name: "options.json", source }]);
};

const healthCheck = (selection: Selection, url: string, socketPath?: string): Exec => {
  const target = socketPath === undefined ? `"${url}"` : `--unix-socket "${socketPath}" "${url}"`;
  const script = [
    "deadline=$(( $(date +%s) + 30 ))",
    'while [ "$(date +%s)" -lt "$deadline" ]; do',
    `  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 1 --noproxy '*' ${target} || true)`,
    '  if [ "$status" = 200 ]; then echo "$status"; exit 0; fi',
    "  sleep 0.1",
    "done",
    'echo "last status: $status"',
    `tail -n 50 "${selection.logPath}"`,
    "exit 1",
  ].join("\n");
  return { command: ["sh", "-c", script], expect: { stdout: ["200"] } };
};

const version = (key: string): Exec => ({
  command: ["sh", "-c", "code-server --version | awk 'NR == 1 { print $1 }'"],
  expect: { stdout: [key] },
});

const installed = (): readonly Exec[] => [
  { command: ["sh", "-c", "command -v code-server"], expect: { stdout: ["/usr/local/bin/code-server"] } },
  {
    command: ["readlink", "-f", "/usr/local/bin/code-server"],
    expect: { stdout: [`${installedDir}/bin/code-server`] },
  },
];

const logLine = (selection: Selection, line: string): Exec => ({
  command: ["sh", "-c", `grep -Fq -- '${line}' "${selection.logPath}"`],
  expect: { stdout: [] },
});

const logCount = (selection: Selection, text: string, count: number): Exec => ({
  command: ["sh", "-c", `grep -Fc -- '${text}' "${selection.logPath}"`],
  expect: { stdout: [String(count)] },
});

const processUser = (selection: Selection): Exec => ({
  command: ["sh", "-c", `pid=$(cat "${selection.pidPath}"); ps -o user= -p "$pid"`],
  expect: { stdout: ["verify"], fields: true },
});

const processCount = (): Exec => ({
  command: ["sh", "-c", `pgrep -P 1 -c -f '^${nodePath} '`],
  expect: { stdout: ["1"] },
});

const reused = (selection: Selection): Exec => ({
  command: [
    "sh",
    "-c",
    [
      `pid=$(cat "${selection.pidPath}")`,
      "output=$(mktemp)",
      `if ! ${postStart} > "$output" 2>&1; then`,
      '  cat "$output"',
      "  exit 1",
      "fi",
      'rm -f "$output"',
      `now=$(cat "${selection.pidPath}")`,
      'if [ "$pid" != "$now" ]; then echo "pid changed from $pid to $now"; exit 1; fi',
      `count=$(pgrep -P 1 -c -f '^${nodePath} ')`,
      'if [ "$count" != 1 ]; then echo "process count: $count"; exit 1; fi',
      "echo reused",
    ].join("\n"),
  ],
  expect: { stdout: ["reused"] },
});

const stopped = (selection: Selection, socketPath: string): Exec => ({
  command: [
    "sh",
    "-c",
    [
      `pid=$(cat "${selection.pidPath}")`,
      'kill "$pid"',
      "deadline=$(( $(date +%s) + 10 ))",
      `while [ -e "${socketPath}" ] && [ "$(date +%s)" -lt "$deadline" ]; do sleep 0.05; done`,
      `if [ -e "${socketPath}" ]; then echo "socket still present"; exit 1; fi`,
      "echo removed",
    ].join("\n"),
  ],
  expect: { stdout: ["removed"] },
});

const defaultExecs = (selection: Selection): readonly Exec[] => [
  healthCheck(selection, "http://127.0.0.1:8080/healthz"),
  version(selection.key),
  ...installed(),
  logLine(selection, "HTTP server listening on http://127.0.0.1:8080/"),
  logLine(selection, "  - Authentication is disabled"),
  processUser(selection),
  processCount(),
  reused(selection),
];

const passwordExecs = (selection: Selection): readonly Exec[] => [
  healthCheck(selection, "http://127.0.0.1:8080/healthz"),
  logLine(selection, "  - Authentication is enabled"),
  logLine(selection, "    - Using password from $PASSWORD"),
];

const socketExecs = (selection: Selection, socketPath: string): readonly Exec[] => [
  healthCheck(selection, "http://localhost/healthz", socketPath),
  { command: ["stat", "-c", "%a", socketPath], expect: { stdout: ["600"] } },
  logLine(selection, `HTTP server listening on ${socketPath}`),
  stopped(selection, socketPath),
];

const argsExecs = (selection: Selection): readonly Exec[] => [
  healthCheck(selection, "http://127.0.0.1:18080/healthz"),
  logLine(selection, "HTTP server listening on http://127.0.0.1:18080/"),
  logCount(selection, "Using extensions-dir ", 1),
];

const smokeExecs = (selection: Selection): readonly Exec[] => [
  healthCheck(selection, "http://127.0.0.1:8080/healthz"),
  version(selection.key),
  ...installed(),
  logLine(selection, "  - Authentication is disabled"),
];

const unknownOptionsVariant = (selection: Selection, root: string): ScenarioVariant => ({
  name: "options-unknown",
  workspace: lifecycle.workspaceAt(root, "default-options-unknown"),
  testImage: testImageOf("default-options-unknown", selection, [
    { name: "options.json", source: path.join(import.meta.dirname, "assets", "options-unknown.json") },
  ]),
  buildFailure: "install: /opt/devcontainer-config/features/code-server/options.json",
});

const createScenario = async (name: ScenarioName, context: ScenarioContext): Promise<Scenario> => {
  const { selection, target, root, workspace } = context;
  switch (name) {
    case "default":
      return {
        name,
        workspace,
        testImage: testImageOf(name, selection),
        execs: defaultExecs(selection),
        variants: [unknownOptionsVariant(selection, root)],
      };
    case "password": {
      const passwordPath = posix.join(workspace.containerPath, "password");
      return {
        name,
        workspace,
        testImage: await optionsImage(name, root, selection, { auth: "password", passwordFile: passwordPath }),
        execs: passwordExecs(selection),
        stage: async (staged) => {
          await writeFile(path.join(staged.path, "password"), "verify-password\n");
        },
      };
    }
    case "socket": {
      const socketPath = posix.join(workspace.containerPath, "code-server.sock");
      return {
        name,
        workspace,
        testImage: await optionsImage(name, root, selection, { socket: socketPath }),
        execs: socketExecs(selection, socketPath),
      };
    }
    case "args":
      return {
        name,
        workspace,
        testImage: await optionsImage(name, root, selection, {
          args: ["--verbose", "--bind-addr", "127.0.0.1:18080"],
        }),
        execs: argsExecs(selection),
      };
    case "smoke": {
      if (target === undefined) {
        throw new Error("The smoke scenario requires --component and --version");
      }
      return {
        name,
        workspace,
        testImage: testImageOf(name, selection),
        execs: smokeExecs(selection),
      };
    }
  }
};

export const scenarios = {
  create: createScenario,
} as const;
