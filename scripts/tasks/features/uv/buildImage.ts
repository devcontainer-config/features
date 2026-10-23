import path from "node:path";
import { parseArgs } from "node:util";

import { $$ } from "@/scripts/shell.js";
import { defaultRefPrefix, mainChannel } from "@/scripts/tasks/features/tags.js";

import { assembleBuildContext } from "./buildContext.js";
import { readConfig } from "./generateConfig.js";
import { parseInvocation } from "./invocation.js";
import { ensureFeatureBinary } from "./packBinary.js";
import type { DockerArch } from "./paths.js";
import { paths } from "./paths.js";
import { payloadPresent } from "./payload.js";
import { imageRefs, tagNames } from "./tags.js";

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

  const featureBinaries: Partial<Record<DockerArch, string>> = {};
  if (component === "uv") {
    featureBinaries[arch] = await ensureFeatureBinary(paths.ridFor(arch), values.force);
  }
  if (!(await payloadPresent(component, version, arch))) {
    throw new Error(
      `No payload at ${paths.payloadPath(component, version, arch)}; run scripts/tasks/features/uv/fetchPayload.ts --component ${component} --version ${version} --arch ${arch} first`,
    );
  }

  const context = await assembleBuildContext(component, version, [arch], featureBinaries);
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
