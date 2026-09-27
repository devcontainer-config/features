import path from "node:path";
import { parseArgs } from "node:util";

import { $$ } from "@/scripts/shell.js";

import { assembleBuildContext } from "./buildContext.js";
import { readConfig } from "./generateConfig.js";
import { parseInvocation } from "./invocation.js";
import { ensurePackBinary } from "./packBinary.js";
import { paths } from "./paths.js";
import { defaultRefPrefix, imageRefs, mainChannel, tagNames } from "./tags.js";

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      component: { type: "string" },
      version: { type: "string" },
      arch: { type: "string" },
      tag: { type: "string", multiple: true },
      channel: { type: "string", default: mainChannel },
      prefix: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });

  const { component, version, arch } = parseInvocation(values);
  const channel = values.channel;
  const prefix = values.prefix ?? (await defaultRefPrefix());
  if (arch !== paths.hostArch()) {
    throw new Error(
      `--arch ${arch} does not match the host architecture ${paths.hostArch()}; local image builds build the current platform only`,
    );
  }

  const install = await ensurePackBinary("install", paths.ridFor(arch), values.force);
  const payload = paths.payloadPath(component, version, arch);
  if (!(await paths.isFile(path.join(payload, "dotnet")))) {
    throw new Error(
      `No payload at ${payload}; run scripts/tasks/features/dotnet/fetchPayload.ts --component ${component} --version ${version} --arch ${arch} first`,
    );
  }

  const context = await assembleBuildContext(component, version, { [arch]: install });
  const config = await readConfig();
  const refs = [...imageRefs(prefix, component, tagNames(config, component, version, channel)), ...(values.tag ?? [])];
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
