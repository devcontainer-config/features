import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import type { Expectation } from "./assertions.js";
import { assertions } from "./assertions.js";
import { imagesModes, lifecycle, testImagePrefix } from "./lifecycle.js";
import { selection } from "./selection.js";
import { staging } from "./staging.js";

interface Exec {
  command: readonly string[];
  expect: Expectation;
}

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

export const verify = async (argv: string[]): Promise<void> => {
  const { values } = parseArgs({
    args: argv,
    options: {
      force: { type: "boolean", default: false },
      rmi: { type: "boolean", default: false },
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
  const derived = await selection.derive(channel, prefix);
  console.log(`>>> verify ripgrep: selection version=${derived.version} ref=${derived.ref}`);

  const tempPath = await mkdtempDisposable(path.join(tmpdir(), "devcontainer-verify-ripgrep-"));
  const workspace = lifecycle.workspaceAt(tempPath.path, "default");
  const testImage = `${testImagePrefix}:${derived.version}`;

  try {
    console.log(">>> verify ripgrep: provision");
    await lifecycle.provision({
      images,
      version: derived.version,
      ref: derived.ref,
      channel,
      prefix,
      force: values.force,
    });

    console.log(">>> verify ripgrep: test image");
    await lifecycle.buildTestImage(path.join(tempPath.path, "ctx"), derived.version, derived.ref);

    console.log(">>> verify ripgrep: workspace");
    await lifecycle.createWorkspace(workspace, { image: testImage });
    await staging.features(workspace);

    console.log(">>> verify ripgrep: scenario default");
    await lifecycle.buildContainer(workspace);
    await lifecycle.startContainer(workspace);
    for (const exec of defaultExecs(derived.version)) {
      assertions.exec(await lifecycle.execInContainer(workspace, exec), exec.expect);
    }
  } finally {
    console.log(">>> verify ripgrep: cleanup");
    await lifecycle.removeContainer(workspace);
    await lifecycle.removeWorkspaceImages(workspace);
    if (values.rmi) {
      await lifecycle.removeImage(testImage);
    }
    await tempPath.remove();
  }
};
