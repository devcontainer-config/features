import path from "node:path";

import { z } from "zod";

import { parseVerifyArguments, selectionSchema } from "../arguments.js";
import { lifecycle } from "../lifecycle.js";
import type { Exec } from "../run.js";
import { runSuite } from "../run.js";
import { selection } from "./selection.js";

const names = ["default", "smoke"] as const;
type ScenarioName = (typeof names)[number];

const scenarioSelectionSchema = selectionSchema(z.enum(names), names, ["default"]);

const targetSchema = z.object({
  component: z.literal("ripgrep").optional(),
  version: z.string().min(1).optional(),
});

const testImagePrefix = "features-verify-ripgrep";
const testImageDockerfile = path.join(import.meta.dirname, "test-image.Dockerfile");

const installedFiles = [
  "/usr/local/share/man/man1/rg.1",
  "/usr/local/share/bash-completion/completions/rg",
  "/usr/local/share/zsh/site-functions/_rg",
  "/usr/local/share/fish/vendor_completions.d/rg.fish",
  "/usr/local/share/doc/ripgrep/COPYING",
  "/usr/local/share/doc/ripgrep/LICENSE-MIT",
  "/usr/local/share/doc/ripgrep/UNLICENSE",
];

const defaultExecs = (version: string): Exec[] => [
  {
    command: ["sh", "-c", "rg --version | awk 'NR == 1 { print $1, $2 }'"],
    expect: { stdout: [`ripgrep ${version}`] },
  },
  {
    command: ["sh", "-c", "rg --version | grep -Fx 'features:+pcre2'"],
    expect: { stdout: ["features:+pcre2"] },
  },
  {
    command: ["sh", "-c", "command -v rg"],
    expect: { stdout: ["/usr/local/bin/rg"] },
  },
  {
    command: ["sh", "-c", "printf 'alpha\\nbeta\\n' | rg beta"],
    expect: { stdout: ["beta"] },
  },
  {
    command: [
      "sh",
      "-c",
      `for file in ${installedFiles.join(" ")}; do test -s "$file" || { echo "missing $file"; exit 1; }; done; echo present`,
    ],
    expect: { stdout: ["present"] },
  },
];

const smokeExecs = (version: string): Exec[] => [
  {
    command: ["sh", "-c", "rg --version | awk 'NR == 1 { print $1, $2 }'"],
    expect: { stdout: [`ripgrep ${version}`] },
  },
  {
    command: ["sh", "-c", "rg --version | grep -Fx 'features:+pcre2'"],
    expect: { stdout: ["features:+pcre2"] },
  },
  { command: ["rg", "--help"], expect: { exitCode: 0 } },
];

const execsOf: Record<ScenarioName, (version: string) => readonly Exec[]> = {
  default: defaultExecs,
  smoke: smokeExecs,
};

export const verify = async (argv: string[]): Promise<void> => {
  const { options, scenarios: requested, component, version } = await parseVerifyArguments(argv);
  const selected = scenarioSelectionSchema.parse(requested);
  const { version: key } = targetSchema.parse({ component, version });
  const derived = await selection.derive(options.channel, options.prefix, key);
  console.log(`>>> verify ripgrep: selection version=${derived.key} ref=${derived.ref}`);

  await runSuite({
    ...options,
    name: "ripgrep",
    create: (root) =>
      selected.map((name) => ({
        name,
        workspace: lifecycle.workspaceAt(root, name),
        testImage: {
          tag: `${testImagePrefix}:${derived.key}`,
          components: [derived],
          dockerfile: testImageDockerfile,
          args: [`RIPGREP_IMAGE_REF=${derived.ref}`],
        },
        execs: execsOf[name](derived.key),
      })),
  });
};
