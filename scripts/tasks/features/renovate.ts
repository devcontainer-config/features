import fs from "node:fs/promises";

import { Octokit } from "@octokit/rest";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { getRemoteInfo } from "@/scripts/git.js";
import { projectRoot } from "@/scripts/project.js";

export interface RefreshOptions {
  branch: string;
  title: string;
  filepath: string;
  body: (headOid: string) => Promise<string>;
}

export const refresh = async (options: RefreshOptions, dryRun: boolean): Promise<void> => {
  const [row] = await git.statusMatrix({ fs, dir: projectRoot, filepaths: [options.filepath] });
  if (row === undefined) {
    throw new Error(`git status returned no row for ${options.filepath}`);
  }
  if (row[1] === row[2]) {
    console.log(`${options.filepath} is unchanged; nothing to do`);
    return;
  }

  const headOid = await git.resolveRef({ fs, dir: projectRoot, ref: "HEAD" });
  const body = await options.body(headOid);
  if (dryRun) {
    console.log(`Dry run: the regenerated ${options.filepath} differs from HEAD; the refresh commit would be:`);
    console.log(`${options.title}\n\n${body}`);
    console.log("Dry run: no branch update, no push, no pull request");
    return;
  }

  const token = process.env.GH_TOKEN;
  if (token === undefined || token === "") {
    throw new Error("GH_TOKEN environment variable is not set");
  }
  const branch = await git.currentBranch({ fs, dir: projectRoot, fullname: false });
  if (!branch) {
    throw new Error("Failed to determine the current branch");
  }

  await git.branch({ fs, dir: projectRoot, ref: options.branch, object: headOid, force: true });
  await git.add({ fs, dir: projectRoot, filepath: options.filepath });
  await git.commit({
    fs,
    dir: projectRoot,
    ref: `refs/heads/${options.branch}`,
    message: `${options.title}\n\n${body}`,
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
    ref: `refs/heads/${options.branch}`,
    force: true,
    onAuth: () => ({ username: "git", password: token }),
  });

  const { owner, repo } = await getRemoteInfo();
  const octokit = new Octokit({ auth: token });
  const open = await octokit.rest.pulls.list({ owner, repo, state: "open", head: `${owner}:${options.branch}` });
  if (open.data.length > 0) {
    console.log(`Pushed ${options.branch}; the open pull request keeps its diff`);
    return;
  }
  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    head: options.branch,
    base: branch,
    draft: true,
    title: options.title,
    body,
  });
  console.log(`Opened ${created.data.html_url}`);
};
