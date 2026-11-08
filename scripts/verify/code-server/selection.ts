import { posix } from "node:path";

import { codeServer, documentOf } from "@/scripts/tasks/features/code-server/feature.js";
import { configPath, readConfig } from "@/scripts/tasks/features/code-server/generateConfig.js";
import { claimedKey } from "@/scripts/tasks/features/config.js";
import { imageEntry } from "@/scripts/tasks/features/imageEntries.js";

import type { ComponentImage } from "../lifecycle.js";
import { userInit } from "../userInit.js";

const component = "code-server";

export interface Selection extends ComponentImage {
  logPath: string;
  pidPath: string;
}

export interface SelectionTarget {
  component: "code-server";
  key: string;
}

const derive = async (channel: string, prefix: string, target?: SelectionTarget): Promise<Selection> => {
  const config = await readConfig();
  const key = target?.key ?? claimedKey(config.aliases, "latest", configPath);
  const { canonical } = imageEntry(codeServer, documentOf(config), prefix, channel, { component, key });
  const cachePath = posix.join(await userInit.xdgPath("XDG_CACHE_HOME"), component);
  const statePath = posix.join(await userInit.xdgPath("XDG_STATE_HOME"), component);
  return {
    component,
    key,
    ref: canonical,
    logPath: posix.join(cachePath, "code-server.log"),
    pidPath: posix.join(statePath, "code-server.pid"),
  };
};

export const selection = { derive } as const;
