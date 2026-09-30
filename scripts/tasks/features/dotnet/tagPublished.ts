import fs from "node:fs/promises";
import { parseArgs } from "node:util";

import { Octokit } from "@octokit/rest";
import git from "isomorphic-git";

import { getRemoteInfo } from "@/scripts/git.js";
import { projectRoot } from "@/scripts/project.js";

import { readConfig } from "./generateConfig.js";
import { parseComponent, parseVersion } from "./invocation.js";
import { canonicalTag, mainChannel } from "./tags.js";

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "status" in error && error.status === 404;

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      component: { type: "string" },
      version: { type: "string" },
    },
  });

  const component = parseComponent(values.component);
  const version = parseVersion(values.version);
  const token = process.env.GH_TOKEN;
  if (token === undefined || token === "") {
    throw new Error("GH_TOKEN environment variable is not set");
  }
  const config = await readConfig();
  const name = `features-dotnet-${component}-${canonicalTag(config, component, version, mainChannel)}`;
  const oid = await git.resolveRef({ fs, dir: projectRoot, ref: "HEAD" });
  const { owner, repo } = await getRemoteInfo();
  const octokit = new Octokit({ auth: token });
  try {
    await octokit.rest.git.getRef({ owner, repo, ref: `tags/${name}` });
    console.log(`Tag ${name} already exists`);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
    await octokit.rest.git.createRef({ owner, repo, ref: `refs/tags/${name}`, sha: oid });
    console.log(`Tagged ${name} at ${oid}`);
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
