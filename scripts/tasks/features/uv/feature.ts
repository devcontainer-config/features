import type { ConfigDocument } from "@/scripts/tasks/features/config.js";
import type { Feature, FeatureStage } from "@/scripts/tasks/features/feature.js";

import type { Component, FeatureConfig } from "./generateConfig.js";
import { components, componentSchema, configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";
import { ensureFeatureBinary } from "./packBinary.js";
import { derive, ensurePayload, payloadPresent, sectionOf } from "./payload.js";

const repositories: Record<Component, string> = { uv: "uv", python: "uv/python" };

const stages: Record<Component, FeatureStage> = {
  uv: { subdir: ["uv"], files: ["install", "onCreate"], binary: true },
  python: { subdir: ["python"], files: [], binary: false },
};

export const documentOf = (config: FeatureConfig): ConfigDocument => ({
  revision: config.revision,
  namespaces: components.map((component) => ({
    name: component,
    versions: config.components[component].versions,
    aliases: config.components[component].aliases,
  })),
});

export const uv: Feature = {
  id: "uv",
  configPath,
  components,
  document: async () => documentOf(await readConfig()),
  parseDocument: (text, source) => documentOf(parseConfig(text, source)),
  generateConfig,
  repository: (component) => repositories[componentSchema.parse(component)],
  stage: (component) => stages[componentSchema.parse(component)],
  payload: {
    ensure: async (component, key, arch, force) =>
      ensurePayload(sectionOf(await readConfig(), componentSchema.parse(component), key), arch, force),
    present: async (component, key, arch) =>
      payloadPresent(derive(sectionOf(await readConfig(), componentSchema.parse(component), key), arch)),
  },
  binary: { ensure: ensureFeatureBinary },
  gitTag: (component, canonical) => `features-uv-${componentSchema.parse(component)}-${canonical}`,
};
