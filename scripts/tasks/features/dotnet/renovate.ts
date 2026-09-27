import fs from "node:fs/promises";
import path from "node:path";

import { Octokit } from "@octokit/rest";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { projectRoot } from "@/scripts/project.js";
import { getRemoteInfo } from "@/scripts/tasks/build.js";

import type { Component, FeatureConfig } from "./generateConfig.js";
import { components, configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";

const refreshBranch = "renovate";
const title = "Update dotnet version pins";
const configFilepath = path.relative(projectRoot, configPath);
const textDecoder = new TextDecoder();

const versionPins = (previous: FeatureConfig, next: FeatureConfig): string[] =>
  components.flatMap((component: Component) => {
    const before = Object.keys(previous.components[component].versions);
    const after = Object.keys(next.components[component].versions);
    const removed = before.filter((version) => !after.includes(version));
    const added = after.filter((version) => !before.includes(version));
    if (removed.length === 0 && added.length === 0) {
      return [];
    }
    return [`${component}: ${removed.join(", ")} → ${added.join(", ")}`];
  });

const headConfig = async (oid: string): Promise<FeatureConfig> => {
  const { blob } = await git.readBlob({ fs, dir: projectRoot, oid, filepath: configFilepath });
  return parseConfig(textDecoder.decode(blob), `${configFilepath} at HEAD`);
};

const main = async (): Promise<void> => {
  await generateConfig();
  const [row] = await git.statusMatrix({ fs, dir: projectRoot, filepaths: [configFilepath] });
  if (row === undefined) {
    throw new Error(`git status returned no row for ${configFilepath}`);
  }
  if (row[1] === row[2]) {
    console.log(`${configFilepath} is unchanged; nothing to do`);
    return;
  }

  const token = process.env.GH_TOKEN;
  if (token === undefined || token === "") {
    throw new Error("GH_TOKEN environment variable is not set");
  }
  const headOid = await git.resolveRef({ fs, dir: projectRoot, ref: "HEAD" });
  const branch = await git.currentBranch({ fs, dir: projectRoot, fullname: false });
  if (!branch) {
    throw new Error("Failed to determine the current branch");
  }
  const body = versionPins(await headConfig(headOid), await readConfig()).join("\n");

  await git.branch({ fs, dir: projectRoot, ref: refreshBranch, object: headOid, force: true });
  await git.add({ fs, dir: projectRoot, filepath: configFilepath });
  await git.commit({
    fs,
    dir: projectRoot,
    ref: refreshBranch,
    message: `${title}\n\n${body}`,
    author: { name: "Renovate", email: "" },
  });
  const remote = (await git.listRemotes({ fs, dir: projectRoot })).at(0);
  if (remote === undefined) {
    throw new Error("Git remote not found");
  }
  await git.push({
    fs,
    http,
    dir: projectRoot,
    remote: remote.remote,
    ref: refreshBranch,
    force: true,
    onAuth: () => ({ username: "git", password: token }),
  });

  const { owner, repo } = await getRemoteInfo();
  const octokit = new Octokit({ auth: token });
  const open = await octokit.rest.pulls.list({ owner, repo, state: "open", head: `${owner}:${refreshBranch}` });
  if (open.data.length > 0) {
    console.log(`Pushed ${refreshBranch}; the open pull request keeps its diff`);
    return;
  }
  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    head: refreshBranch,
    base: branch,
    draft: true,
    title,
    body,
  });
  console.log(`Opened ${created.data.html_url}`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
