import path from "node:path";
import { parseArgs } from "node:util";

import { $$ } from "@/scripts/shell.js";

import { assembleBuildContext } from "./buildContext.js";
import { readConfig } from "./generateConfig.js";
import { resolveInstallBinaries } from "./installBinary.js";
import { parseComponent, parseVersion } from "./invocation.js";
import { paths } from "./paths.js";
import { ensurePayload } from "./payload.js";
import { login } from "./registry.js";
import { defaultRefPrefix, imageRefs, mainChannel, tagNames } from "./tags.js";

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
  const installBinaries = await resolveInstallBinaries(values["install-dir"]);
  for (const arch of paths.dockerArchOptions) {
    await ensurePayload(component, version, arch, false);
  }
  const context = await assembleBuildContext(component, version, installBinaries);
  await login(prefix);
  const refs = imageRefs(prefix, component, tags);
  await $$`docker buildx build ${[
    ...["--platform", paths.dockerArchOptions.map((arch) => `linux/${arch}`).join(",")],
    "--push",
    ...["--file", path.join(context, "docker", "Dockerfile")],
    ...refs.flatMap((ref) => ["--tag", ref]),
    context,
  ]}`;
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
