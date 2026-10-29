import path from "node:path";
import { parseArgs } from "node:util";

import { $$ } from "@/scripts/shell.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assembleBuildContext } from "./buildContext.js";
import { readConfig } from "./generateConfig.js";
import { parseInvocation } from "./invocation.js";
import { paths } from "./paths.js";
import { derive, loadSection, payloadPresent } from "./payload.js";
import { imageRefs, tagNames } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
      arch: { type: "string" },
      channel: { type: "string", default: mainChannel },
      tag: { type: "string", multiple: true },
      prefix: { type: "string" },
    },
  });

  const { key, arch } = parseInvocation(values);
  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  if (arch !== paths.hostArch()) {
    throw new Error(
      `--arch ${arch} does not match the host architecture ${paths.hostArch()}; local image builds build the current platform only`,
    );
  }

  const section = await loadSection(key);
  const payload = derive(section, arch);
  if (!(await payloadPresent(payload))) {
    throw new Error(
      `No payload at ${payload.cache}; run scripts/tasks/features/ripgrep/fetchPayload.ts --version ${key} --arch ${arch} first`,
    );
  }

  const context = await assembleBuildContext(key, [arch]);
  const config = await readConfig();
  const refs = [...imageRefs(prefix, tagNames(config, key, channel).all), ...(values.tag ?? [])];
  await $$`docker buildx build ${[
    ...["--platform", `linux/${arch}`],
    "--load",
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
