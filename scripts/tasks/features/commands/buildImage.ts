import path from "node:path";
import { parseArgs } from "node:util";

import { $$ } from "@/scripts/shell.js";

import type { DockerArch } from "../architecture.js";
import { hostArch, ridFor } from "../architecture.js";
import { assembleBuildContext } from "../buildContext.js";
import { requireBinary } from "../feature.js";
import { imageEntry } from "../imageEntries.js";
import { payloadPath } from "../paths.js";
import {
  archSchema,
  channelOptions,
  featureOption,
  featureSchema,
  resolvePrefix,
  targetOptions,
  targetSchemaFor,
} from "./arguments.js";

export const buildImage = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      feature: featureOption,
      ...targetOptions,
      arch: { type: "string" },
      tag: { type: "string", multiple: true },
      ...channelOptions,
      force: { type: "boolean", default: false },
    },
  });
  const feature = featureSchema.parse(values.feature);
  const { component, key } = targetSchemaFor(feature).parse(values);
  const arch = archSchema.parse(values.arch);
  const channel = values.channel;
  const prefix = await resolvePrefix(values.prefix);
  if (arch !== hostArch()) {
    throw new Error(
      `--arch ${arch} does not match the host architecture ${hostArch()}; local image builds build the current platform only`,
    );
  }
  if (!(await feature.payload.present(component, key, arch))) {
    throw new Error(
      `No payload at ${payloadPath(feature.id, component, key, arch)}; run the pipeline fetch-payload command for ${component} ${key} ${arch} first`,
    );
  }
  const featureBinaries: Partial<Record<DockerArch, string>> = {};
  if (feature.stage(component, key).binary) {
    featureBinaries[arch] = await requireBinary(feature).ensure(ridFor(arch), values.force);
  }
  const context = await assembleBuildContext(feature, component, key, [arch], featureBinaries);
  const entry = imageEntry(feature, await feature.document(), prefix, channel, { component, key });
  const refs = [...entry.refs, ...(values.tag ?? [])];
  await $$`docker buildx build ${[
    ...["--platform", `linux/${arch}`],
    "--load",
    ...["--file", path.join(context, "docker", "Dockerfile")],
    ...refs.flatMap((ref) => ["--tag", ref]),
    context,
  ]}`;
  console.log(refs.join("\n"));
};
