import type { DockerArch, Rid } from "./architecture.js";
import type { ConfigDocument } from "./config.js";

export interface FeatureStage {
  subdir: readonly string[];
  files: readonly string[];
  binary: boolean;
}

export interface Feature {
  id: string;
  configPath: string;
  components: readonly string[];
  document(): Promise<ConfigDocument>;
  parseDocument(text: string, source: string): ConfigDocument;
  generateConfig(): Promise<void>;
  repository(component: string): string;
  stage(component: string, key: string): FeatureStage;
  payload: {
    ensure(component: string, key: string, arch: DockerArch, force: boolean): Promise<void>;
    present(component: string, key: string, arch: DockerArch): Promise<boolean>;
  };
  binary?: {
    ensure(rid: Rid, force: boolean): Promise<string>;
  };
  gitTag(component: string, canonical: string): string;
}

export const requireBinary = (feature: Feature): NonNullable<Feature["binary"]> => {
  const binary = feature.binary;
  if (binary === undefined) {
    throw new Error(`Feature ${feature.id} has no Feature binary`);
  }
  return binary;
};
