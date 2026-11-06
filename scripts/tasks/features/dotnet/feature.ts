import type { ConfigDocument } from "@/scripts/tasks/features/config.js";
import type { Feature, FeatureStage } from "@/scripts/tasks/features/feature.js";

import type { FeatureConfig } from "./generateConfig.js";
import { components, componentSchema, configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";
import { ensureFeatureBinary } from "./packBinary.js";
import { ensurePayload, payloadPresent } from "./payload.js";

export const documentOf = (config: FeatureConfig): ConfigDocument => ({
  revision: config.revision,
  namespaces: components.map((component) => ({
    name: component,
    versions: config.components[component].versions,
    aliases: config.components[component].aliases,
  })),
});

export const dotnet: Feature = {
  id: "dotnet",
  configPath,
  components,
  document: async () => documentOf(await readConfig()),
  parseDocument: (text, source) => documentOf(parseConfig(text, source)),
  generateConfig,
  repository: (component) => `dotnet/${componentSchema.parse(component)}`,
  stage: (component, key): FeatureStage => {
    componentSchema.parse(component);
    return { subdir: [component, key], files: ["install"], binary: true };
  },
  payload: {
    ensure: async (component, key, arch, force) => ensurePayload(componentSchema.parse(component), key, arch, force),
    present: async (component, key, arch) => payloadPresent(componentSchema.parse(component), key, arch),
  },
  binary: { ensure: ensureFeatureBinary },
  gitTag: (component, canonical) => `features-dotnet-${componentSchema.parse(component)}-${canonical}`,
};
