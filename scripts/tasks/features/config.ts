import { readFile, writeFile } from "node:fs/promises";

import * as prettier from "prettier";
import { z } from "zod";

import prettierOptions from "@/.config/prettier/.prettierrc.json" with { type: "json" };

export const tagPattern = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/u;

// The names a key derives before any channel suffix; tagNames takes the first as canonical.
export const mainTagNames = (key: string, revision: number, aliases: readonly string[]): readonly string[] => [
  `${key}-r${revision}`,
  key,
  ...aliases,
];

export type AliasTable = Readonly<Record<string, readonly string[]>>;

export interface ConfigNamespace {
  name: string;
  versions: Readonly<Record<string, unknown>>;
  aliases: AliasTable;
}

export interface ConfigDocument {
  revision: number;
  namespaces: readonly ConfigNamespace[];
}

export interface ConfigEntry {
  component: string;
  key: string;
}

export const configEntries = (document: ConfigDocument): ConfigEntry[] =>
  document.namespaces.flatMap((namespace) =>
    Object.keys(namespace.versions).map((key) => ({ component: namespace.name, key })),
  );

export interface TagNamespace {
  source: string;
  revision: number;
  versions: Readonly<Record<string, unknown>>;
  aliases: AliasTable;
  requiredClaims: readonly string[];
}

// The single inversion of an alias table: alias → version key. Rejects a name claimed twice.
export const aliasClaims = (aliases: AliasTable, source: string): Map<string, string> => {
  const claims = new Map<string, string>();
  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      const owner = claims.get(name);
      if (owner === key) {
        throw new Error(`${source}: alias ${name} is claimed twice by ${key}`);
      }
      if (owner !== undefined) {
        throw new Error(`${source}: alias ${name} is claimed by ${owner} and ${key}`);
      }
      claims.set(name, key);
    }
  }
  return claims;
};

export const claimedKey = (aliases: AliasTable, alias: string, source: string): string => {
  const key = aliasClaims(aliases, source).get(alias);
  if (key === undefined) {
    throw new Error(`${source}: no version claims the ${alias} alias`);
  }
  return key;
};

export const checkTagNamespace = (namespace: TagNamespace): void => {
  const { source, revision, versions, aliases, requiredClaims } = namespace;
  for (const key of Object.keys(versions)) {
    if (!Object.hasOwn(aliases, key)) {
      throw new Error(`${source}: version ${key} has no aliases row`);
    }
  }
  for (const key of Object.keys(aliases)) {
    if (!Object.hasOwn(versions, key)) {
      throw new Error(`${source}: aliases row ${key} has no version`);
    }
  }
  const claims = aliasClaims(aliases, source);
  for (const claim of requiredClaims) {
    if (!claims.has(claim)) {
      throw new Error(`${source}: no version claims the ${claim} alias`);
    }
  }
  const owners = new Map<string, string>();
  for (const key of Object.keys(versions)) {
    for (const name of mainTagNames(key, revision, aliases[key])) {
      if (!tagPattern.test(name)) {
        throw new Error(`${source}: tag ${name} derived by ${key} is not a valid registry tag name`);
      }
      const owner = owners.get(name);
      if (owner !== undefined && owner !== key) {
        throw new Error(`${source}: tag ${name} is derived by ${owner} and ${key}`);
      }
      owners.set(name, key);
    }
  }
};

export const formatConfig = async (document: unknown, configPath: string): Promise<string> =>
  prettier.format(JSON.stringify(document, null, 2), { ...prettierOptions, filepath: configPath });

export interface ConfigFile<T> {
  parse: (text: string, source: string) => T;
  read: () => Promise<T>;
  /** The document's revision on disk, 1 when the file does not exist yet. */
  revision: () => Promise<number>;
  /** Validates the document, then writes it canonically. */
  write: (config: T) => Promise<void>;
}

export const configFile = <S extends z.ZodType<{ revision: number }>>(options: {
  path: string;
  schema: S;
  validate: (config: z.infer<S>, source: string) => void;
}): ConfigFile<z.infer<S>> => {
  const parse = (text: string, source: string): z.infer<S> => {
    const result = options.schema.safeParse(JSON.parse(text));
    if (!result.success) {
      throw new Error(`${source}: ${z.prettifyError(result.error)}`);
    }
    options.validate(result.data, source);
    return result.data;
  };
  const read = async (): Promise<z.infer<S>> => parse(await readFile(options.path, "utf-8"), options.path);
  return {
    parse,
    read,
    revision: async () => {
      try {
        return (await read()).revision;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return 1;
        }
        throw error;
      }
    },
    write: async (config) => {
      options.validate(config, options.path);
      await writeFile(options.path, await formatConfig(config, options.path));
    },
  };
};
