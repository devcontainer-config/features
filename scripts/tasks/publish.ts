import { Readable } from "node:stream";

import { $ } from "execa";

import { $$, shellOptions } from "@/scripts/shell.js";
import { getRemoteInfo } from "@/scripts/tasks/build.js";

export const publish = async (featuresPath: string) => {
  const { owner, repo } = await getRemoteInfo();
  const login = $({
    ...shellOptions,
    stdio: ["pipe", "inherit", "inherit"],
  })`docker login ghcr.io -u USERNAME --password-stdin`;
  Readable.from([process.env.CR_PAT]).pipe(login.stdin!);
  await login;
  await $$`devcontainer features publish --namespace ${owner}/${repo} ${featuresPath}`;
};
