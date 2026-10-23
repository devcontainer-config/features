import { parseArgs } from "node:util";

import { pushImage } from "@/scripts/tasks/features/image.js";
import { login } from "@/scripts/tasks/features/registry.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assembleBuildContext } from "./buildContext.js";
import { resolveFeatureBinaries } from "./featureBinary.js";
import { readConfig } from "./generateConfig.js";
import { parseComponent, parseVersion } from "./invocation.js";
import { paths } from "./paths.js";
import { ensurePayload } from "./payload.js";
import { imageRefs, tagNames } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      component: { type: "string" },
      version: { type: "string" },
      channel: { type: "string", default: mainChannel },
      "install-dir": { type: "string" },
      prefix: { type: "string" },
    },
  });

  const component = parseComponent(values.component);
  const version = parseVersion(values.version);
  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  const config = await readConfig();
  const tags = tagNames(config, component, version, channel);
  const featureBinaries = await resolveFeatureBinaries(values["install-dir"]);
  for (const arch of paths.dockerArchOptions) {
    await ensurePayload(component, version, arch, false);
  }
  const context = await assembleBuildContext(component, version, featureBinaries);
  await login(prefix);
  const refs = imageRefs(prefix, component, tags);
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
