import { $ } from "execa";

import { getRemoteInfo } from "@/scripts/tasks/build.js";

const ghcrHost = "ghcr.io";

export const login = async (prefix: string): Promise<void> => {
  const token = process.env.GH_TOKEN;
  if (token === undefined || token === "" || prefix.split("/")[0] !== ghcrHost) {
    return;
  }
  const { owner } = await getRemoteInfo();
  await $({ input: token, verbose: "full" })`docker login ${ghcrHost} --username ${owner} --password-stdin`;
};
