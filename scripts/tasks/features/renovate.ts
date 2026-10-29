import fs from "node:fs/promises";

import { Octokit } from "@octokit/rest";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { getRemoteInfo } from "@/scripts/git.js";
import { projectRoot } from "@/scripts/project.js";

const textDecoder = new TextDecoder();

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "NotFoundError";

// A path absent from HEAD (the config before its first commit) yields undefined so a refresh can diff against nothing.
export const headFile = async (oid: string, filepath: string): Promise<string | undefined> => {
  try {
    const { blob } = await git.readBlob({ fs, dir: projectRoot, oid, filepath });
    return textDecoder.decode(blob);
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
};

export interface ConfigNamespace {
  name: string;
  versions: Readonly<Record<string, unknown>>;
  aliases: Readonly<Record<string, readonly string[]>>;
}

export interface ConfigDocument {
  revision: number;
  namespaces: readonly ConfigNamespace[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const diffPaths = (before: unknown, after: unknown, prefix: string): string[] => {
  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap((key) => diffPaths(before[key], after[key], prefix === "" ? key : `${prefix}.${key}`));
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) {
      return [prefix];
    }
    return before.flatMap((value, index) => diffPaths(value, after[index], `${prefix}[${index}]`));
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix];
};

const aliasOwners = (aliases: Readonly<Record<string, readonly string[]>>): Map<string, string> => {
  const owners = new Map<string, string>();
  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      owners.set(name, key);
    }
  }
  return owners;
};

// One shared comparison of a regenerated config against HEAD: added, removed and changed payload entries and alias moves.
// A payload entry that survives a revision must be identical; a revision change turns the failure into a listed change.
export const configChanges = (previous: ConfigDocument, next: ConfigDocument, source: string): string[] => {
  const revisionChanged = previous.revision !== next.revision;
  const changes: string[] = revisionChanged ? [`revision ${previous.revision} → ${next.revision}`] : [];
  const failures: string[] = [];
  for (const namespace of next.namespaces) {
    const before = previous.namespaces.find((candidate) => candidate.name === namespace.name);
    if (before === undefined) {
      throw new Error(`${source}: namespace ${namespace.name} is missing from HEAD`);
    }
    const added = Object.keys(namespace.versions).filter((key) => !Object.hasOwn(before.versions, key));
    const removed = Object.keys(before.versions).filter((key) => !Object.hasOwn(namespace.versions, key));
    changes.push(...added.map((key) => `added ${namespace.name} ${key}`));
    changes.push(...removed.map((key) => `removed ${namespace.name} ${key}`));
    for (const key of Object.keys(namespace.versions)) {
      if (!Object.hasOwn(before.versions, key)) {
        continue;
      }
      const paths = diffPaths(before.versions[key], namespace.versions[key], "");
      if (paths.length === 0) {
        continue;
      }
      changes.push(`changed ${namespace.name} ${key}: ${paths.join(", ")}`);
      if (!revisionChanged) {
        failures.push(
          `${source}: ${namespace.name} ${key} changed within revision ${previous.revision}: ${paths.join(", ")}`,
        );
      }
    }
    const beforeOwners = aliasOwners(before.aliases);
    const afterOwners = aliasOwners(namespace.aliases);
    for (const alias of new Set([...beforeOwners.keys(), ...afterOwners.keys()])) {
      const beforeOwner = beforeOwners.get(alias);
      const afterOwner = afterOwners.get(alias);
      if (beforeOwner === afterOwner) {
        continue;
      }
      if (beforeOwner !== undefined && afterOwner !== undefined) {
        changes.push(`alias ${namespace.name} ${alias}: ${beforeOwner} → ${afterOwner}`);
      } else if (afterOwner !== undefined && !added.includes(afterOwner)) {
        changes.push(`alias ${namespace.name} ${alias}: added to ${afterOwner}`);
      } else if (beforeOwner !== undefined && !removed.includes(beforeOwner)) {
        changes.push(`alias ${namespace.name} ${alias}: removed from ${beforeOwner}`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return changes;
};

export const changeBody = (changes: readonly string[], filepath: string): string => {
  if (changes.length === 0) {
    throw new Error(`${filepath} changed but no version, alias or artifact change was found`);
  }
  return changes.join("\n");
};

const emptyDocument = (document: ConfigDocument): ConfigDocument => ({
  revision: document.revision,
  namespaces: document.namespaces.map(({ name }) => ({ name, versions: {}, aliases: {} })),
});

export interface FeatureConfigRefresh<Config> {
  branch: string;
  title: string;
  filepath: string;
  generate: () => Promise<void>;
  read: () => Promise<Config>;
  parse: (text: string, source: string) => Config;
  document: (config: Config) => ConfigDocument;
}

// A refresh regenerates the config, then compares it against HEAD and opens or updates the feature's branch.
export const refreshFeatureConfig = async <Config>(
  options: FeatureConfigRefresh<Config>,
  dryRun: boolean,
): Promise<void> => {
  await options.generate();
  await refresh(
    {
      branch: options.branch,
      title: options.title,
      filepath: options.filepath,
      body: async (headOid) => {
        const text = await headFile(headOid, options.filepath);
        const previous = text === undefined ? undefined : options.parse(text, `${options.filepath} at HEAD`);
        const next = options.document(await options.read());
        const changes = configChanges(
          previous === undefined ? emptyDocument(next) : options.document(previous),
          next,
          options.filepath,
        );
        return changeBody(changes, options.filepath);
      },
    },
    dryRun,
  );
};

export interface RefreshOptions {
  branch: string;
  title: string;
  filepath: string;
  body: (headOid: string) => Promise<string>;
}

export const refresh = async (options: RefreshOptions, dryRun: boolean): Promise<void> => {
  const [row] = await git.statusMatrix({ fs, dir: projectRoot, filepaths: [options.filepath] });
  if (row === undefined) {
    throw new Error(`git status returned no row for ${options.filepath}`);
  }
  if (row[1] === row[2]) {
    console.log(`${options.filepath} is unchanged; nothing to do`);
    return;
  }

  const headOid = await git.resolveRef({ fs, dir: projectRoot, ref: "HEAD" });
  const body = await options.body(headOid);
  if (dryRun) {
    console.log(`Dry run: the regenerated ${options.filepath} differs from HEAD; the refresh commit would be:`);
    console.log(`${options.title}\n\n${body}`);
    console.log("Dry run: no branch update, no push, no pull request");
    return;
  }

  const token = process.env.GH_TOKEN;
  if (token === undefined || token === "") {
    throw new Error("GH_TOKEN environment variable is not set");
  }
  const branch = await git.currentBranch({ fs, dir: projectRoot, fullname: false });
  if (!branch) {
    throw new Error("Failed to determine the current branch");
  }

  await git.branch({ fs, dir: projectRoot, ref: options.branch, object: headOid, force: true });
  await git.add({ fs, dir: projectRoot, filepath: options.filepath });
  await git.commit({
    fs,
    dir: projectRoot,
    ref: `refs/heads/${options.branch}`,
    message: `${options.title}\n\n${body}`,
    author: { name: "Renovate", email: "" },
  });
  const remote = (await git.listRemotes({ fs, dir: projectRoot })).at(0);
  if (remote === undefined) {
    throw new Error("Git remote not found");
  }
  await git.push({
    fs,
    http,
    dir: projectRoot,
    remote: remote.remote,
    ref: `refs/heads/${options.branch}`,
    force: true,
    onAuth: () => ({ username: "git", password: token }),
  });

  const { owner, repo } = await getRemoteInfo();
  const octokit = new Octokit({ auth: token });
  const open = await octokit.rest.pulls.list({ owner, repo, state: "open", head: `${owner}:${options.branch}` });
  if (open.data.length > 0) {
    console.log(`Pushed ${options.branch}; the open pull request keeps its diff`);
    return;
  }
  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    head: options.branch,
    base: branch,
    draft: true,
    title: options.title,
    body,
  });
  console.log(`Opened ${created.data.html_url}`);
};
