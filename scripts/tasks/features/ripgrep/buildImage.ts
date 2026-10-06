import path from "node:path";
import { parseArgs } from "node:util";

import { $$ } from "@/scripts/shell.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assembleBuildContext } from "./buildContext.js";
import { readConfig } from "./generateConfig.js";
import { parseInvocation } from "./invocation.js";
import { paths } from "./paths.js";
import { imageRefs, tagNames } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
      arch: { type: "string" },
      channel: { type: "string", default: mainChannel },
      prefix: { type: "string" },
    },
  });

  const { version, arch } = parseInvocation(values);
  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  if (arch !== paths.hostArch()) {
    throw new Error(
      `--arch ${arch} does not match the host architecture ${paths.hostArch()}; local image builds build the current platform only`,
    );
  }

  const payload = paths.payloadPath(version, arch);
  if (!(await paths.isFile(path.join(payload, "rg")))) {
    throw new Error(
      `No payload at ${payload}; run scripts/tasks/features/ripgrep/fetchPayload.ts --version ${version} --arch ${arch} first`,
    );
  }

  const context = await assembleBuildContext(version, [arch]);
  const config = await readConfig();
  const refs = imageRefs(prefix, tagNames(config, version, channel));
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
