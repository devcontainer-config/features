import type { ConfigDocument } from "@/scripts/tasks/features/config.js";
import type { Feature, FeatureStage } from "@/scripts/tasks/features/feature.js";

import type { FeatureConfig } from "./generateConfig.js";
import { configPath, generateConfig, parseConfig, readConfig } from "./generateConfig.js";
import { packFeatureBinary } from "./packBinary.js";
import { derive, ensurePayload, loadSection, payloadPresent } from "./payload.js";

const component = "code-server";

export const documentOf = (config: FeatureConfig): ConfigDocument => ({
  revision: config.revision,
  namespaces: [{ name: component, versions: config.versions, aliases: config.aliases }],
});

const stage: FeatureStage = { subdir: ["code-server"], files: ["install", "launch", "postStart"], binary: true };

export const codeServer: Feature = {
  id: "code-server",
  configPath,
  components: [component],
  document: async () => documentOf(await readConfig()),
  parseDocument: (text, source) => documentOf(parseConfig(text, source)),
  generateConfig,
  repository: () => "code-server",
  stage: () => stage,
  payload: {
    ensure: async (_component, key, arch, force) => ensurePayload(await loadSection(key), arch, force),
    present: async (_component, key, arch) => payloadPresent(derive(await loadSection(key), arch)),
  },
  binary: { ensure: packFeatureBinary },
  gitTag: (_component, canonical) => `features-code-server-${canonical}`,
};
