export const tagPattern = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/u;

export type AliasTable = Readonly<Record<string, readonly string[]>>;

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
    for (const name of [`${key}-r${revision}`, key, ...aliases[key]]) {
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
