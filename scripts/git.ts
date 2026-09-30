import fs from "node:fs";

import gitUrlParse from "git-url-parse";
import git from "isomorphic-git";

import { projectRoot } from "@/scripts/project.js";

export const getRemoteInfo = async () => {
  const url = (await git.listRemotes({ fs, dir: projectRoot })).at(0)?.url;
  if (!url) {
    throw new Error("Git remote not found");
  }
  const { owner, name: repo } = gitUrlParse(url);
  return { owner, repo };
};
