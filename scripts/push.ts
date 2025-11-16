import fs from "node:fs/promises";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { projectRoot } from "@/scripts/project.js";

const currentBranch = await git.currentBranch({ fs, dir: projectRoot, fullname: false });
if (!currentBranch) throw new Error("Failed to determine current branch");

const remote = (await git.listRemotes({ fs, dir: projectRoot })).at(0);
if (remote === undefined) {
  throw new Error("Git remote not found");
}
const token = process.env.GIT_REMOTE_TOKEN;
if (!token) throw new Error("GIT_REMOTE_TOKEN environment variable is not set");

await git.push({
  fs,
  http,
  dir: projectRoot,
  remote: remote.remote,
  ref: currentBranch,
  force: true,
  onAuth: () => ({
    username: "git",
    password: token,
  }),
});
