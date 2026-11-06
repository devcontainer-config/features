import type { ConfigDocument, ConfigEntry } from "./config.js";
import { configEntries } from "./config.js";
import type { Feature } from "./feature.js";
import type { TagSource } from "./tags.js";
import { mainChannel, tagNames } from "./tags.js";

export interface ImageEntry {
  entry: ConfigEntry;
  label: string;
  canonical: string;
  refs: readonly string[];
  claims: readonly string[];
  gitTag: string;
}

const imageRef = (feature: Feature, prefix: string, component: string, tag: string): string =>
  `${prefix}/${feature.repository(component)}:${tag}`;

const tagSource = (feature: Feature, document: ConfigDocument, { component, key }: ConfigEntry): TagSource => {
  const namespace = document.namespaces.find((candidate) => candidate.name === component);
  if (namespace === undefined) {
    throw new Error(`${feature.configPath}: the config has no component ${component}`);
  }
  if (!Object.hasOwn(namespace.versions, key)) {
    throw new Error(`${feature.configPath}: component ${component} has no version ${key}`);
  }
  return { key, revision: document.revision, aliases: namespace.aliases[key] };
};

export const imageEntry = (
  feature: Feature,
  document: ConfigDocument,
  prefix: string,
  channel: string,
  entry: ConfigEntry,
): ImageEntry => {
  const source = tagSource(feature, document, entry);
  const tags = tagNames(source, channel);
  const { component, key } = entry;
  const refsOf = (names: readonly string[]): string[] => names.map((tag) => imageRef(feature, prefix, component, tag));
  return {
    entry,
    label: `${component} ${key}`,
    canonical: imageRef(feature, prefix, component, tags.canonical),
    refs: refsOf(tags.all),
    claims: refsOf(tags.claims),
    gitTag: feature.gitTag(component, tagNames(source, mainChannel).canonical),
  };
};

export const imageEntries = (
  feature: Feature,
  document: ConfigDocument,
  prefix: string,
  channel: string,
): ImageEntry[] => configEntries(document).map((entry) => imageEntry(feature, document, prefix, channel, entry));
