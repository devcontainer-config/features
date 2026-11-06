import type { ConfigDocument } from "@/scripts/tasks/features/config.js";
import type { Feature, FeatureStage } from "@/scripts/tasks/features/feature.js";

import type { FeatureConfig } from "./generateConfig.js";
import { configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";
import { derive, ensurePayload, loadSection, payloadPresent } from "./payload.js";

const component = "ripgrep";

export const documentOf = (config: FeatureConfig): ConfigDocument => ({
  revision: config.revision,
  namespaces: [{ name: component, versions: config.versions, aliases: config.aliases }],
});

const stage: FeatureStage = { subdir: [], files: ["install"], binary: false };

export const ripgrep: Feature = {
  id: "ripgrep",
  configPath,
  components: [component],
  document: async () => documentOf(await readConfig()),
  parseDocument: (text, source) => documentOf(parseConfig(text, source)),
  generateConfig,
  repository: () => "ripgrep",
  stage: () => stage,
  payload: {
    ensure: async (_component, key, arch, force) => ensurePayload(await loadSection(key), arch, force),
    present: async (_component, key, arch) => payloadPresent(derive(await loadSection(key), arch)),
  },
  gitTag: (_component, canonical) => `features-ripgrep-${canonical}`,
};
