import { parseArgs } from "node:util";

import { pushImage } from "@/scripts/tasks/features/image.js";
import { login } from "@/scripts/tasks/features/registry.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assembleBuildContext } from "./buildContext.js";
import { readConfig } from "./generateConfig.js";
import { parseVersion } from "./invocation.js";
import { paths } from "./paths.js";
import { ensurePayload } from "./payload.js";
import { imageRefs, tagNames } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
      channel: { type: "string", default: mainChannel },
      prefix: { type: "string" },
    },
  });

  const version = parseVersion(values.version);
  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  const config = await readConfig();
  const tags = tagNames(config, version, channel);
  for (const arch of paths.dockerArchOptions) {
    await ensurePayload(version, arch, false);
  }
  const context = await assembleBuildContext(version, paths.dockerArchOptions);
  await login(prefix);
  const refs = imageRefs(prefix, tags);
  await pushImage(context, refs);
  console.log(refs.join("\n"));
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
