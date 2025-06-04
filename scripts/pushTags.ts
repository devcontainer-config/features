import fs from "node:fs";
import path from "node:path";

import { readBlob } from "isomorphic-git";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { projectRoot } from "@/scripts/project.js";

const defaultBranch = "main";
const remote = (await git.listRemotes({ fs, dir: projectRoot })).at(0);
if (remote === undefined) {
  throw new Error("Git remote not found");
}
const token = process.env.GIT_REMOTE_TOKEN;
if (!token) throw new Error("GIT_REMOTE_TOKEN environment variable is not set");

// Get remote head hash.
const { fetchHead: remoteHead } = await git.fetch({
  fs,
  http,
  dir: projectRoot,
  url: remote.url,
  ref: defaultBranch,
  singleBranch: true,
  tags: true,
});
if (!remoteHead) {
  throw new Error("Remote head not found");
}

// Tag untagged new versions.
const files = await git.listFiles({ fs, dir: projectRoot, ref: remoteHead });
const tags = new Set(await git.listTags({ fs, dir: projectRoot }));
const newTags: string[] = [];
const decoder = new TextDecoder();
for (const filepath of files) {
  if (filepath.startsWith(".devcontainer/features/src") && filepath.endsWith("devcontainer-feature.json")) {
    const { blob } = await readBlob({
      fs,
      dir: projectRoot,
      oid: remoteHead,
      filepath,
    });
    const { version } = JSON.parse(decoder.decode(blob)) as { version: string };
    const tag = `${path.basename(path.dirname(filepath))}_${version}`;
    if (tags.has(tag)) {
      console.log(`Tag ${tag} already exists, skipping...`);
    } else {
      newTags.push(tag);
    }
  }
}

// Push new tags
for (const tag of newTags) {
  console.log(`Tagging ${tag}...`);
  await git.tag({ fs, dir: projectRoot, ref: tag, object: remoteHead });
  // Push the tag to the remote repository
  await git.push({
    fs,
    http,
    dir: projectRoot,
    remote: remote.remote,
    ref: tag,
    onAuth: () => ({
      username: "git",
      password: token,
    }),
  });
  console.log(`Pushed tag ${tag} to remote ${remote.remote}`);
}
