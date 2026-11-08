import { z } from "zod";

export type Version = readonly [number, number, number];

export interface ReleaseAsset {
  name: string;
  url: string;
  digest: string | null;
}

export interface TrackedRelease {
  /** The release tag with its `v` prefix removed. */
  version: string;
  number: Version;
  assets: readonly ReleaseAsset[];
}

const releaseSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(
    z.object({
      name: z.string(),
      browser_download_url: z.string(),
      digest: z.string().nullish(),
    }),
  ),
});

const releasesPageSchema = z.array(releaseSchema);

const sha256Digest = /^sha256:([0-9a-f]{64})$/u;
const versionTag = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

const versionOf = (tag: string): { version: string; number: Version } | undefined => {
  const match = versionTag.exec(tag);
  if (match === null) {
    return undefined;
  }
  const [, major, minor, patch] = match;
  return { version: match[0].replace(/^v/u, ""), number: [Number(major), Number(minor), Number(patch)] };
};

const compare = (left: Version, right: Version): number => {
  for (const [index, part] of left.entries()) {
    if (part !== right[index]) {
      return part - right[index];
    }
  }
  return 0;
};

const fetchReleases = async (repository: string): Promise<z.infer<typeof releasesPageSchema>> => {
  const releases: z.infer<typeof releasesPageSchema> = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`;
    const response = await fetch(url, { headers: { accept: "application/vnd.github+json" } });
    if (!response.ok) {
      throw new Error(`GET ${url} → HTTP ${response.status}`);
    }
    const result = releasesPageSchema.safeParse(await response.json());
    if (!result.success) {
      throw new Error(`GET ${url}: ${z.prettifyError(result.error)}`);
    }
    if (result.data.length === 0) {
      return releases;
    }
    releases.push(...result.data);
  }
};

/** The newest stable release of `repository` at or above `minimum`, by semantic version. */
export const trackedRelease = async (repository: string, minimum?: Version): Promise<TrackedRelease> => {
  const releases = await fetchReleases(repository);
  const candidates = releases.flatMap((release): TrackedRelease[] => {
    if (release.draft || release.prerelease) {
      return [];
    }
    const parsed = versionOf(release.tag_name);
    if (parsed === undefined || (minimum !== undefined && compare(parsed.number, minimum) < 0)) {
      return [];
    }
    return [
      {
        ...parsed,
        assets: release.assets.map((asset) => ({
          name: asset.name,
          url: asset.browser_download_url,
          digest: asset.digest ?? null,
        })),
      },
    ];
  });
  if (candidates.length === 0) {
    const limit = minimum === undefined ? "" : ` at or above ${minimum.join(".")}`;
    throw new Error(`No stable release of ${repository}${limit}`);
  }
  return candidates.reduce((best, candidate) => (compare(candidate.number, best.number) > 0 ? candidate : best));
};

/** The url and sha256 digest of the one release asset named `name`. */
export const artifactOf = (release: TrackedRelease, name: string): { url: string; sha256: string } => {
  const matches = release.assets.filter((asset) => asset.name === name);
  if (matches.length !== 1) {
    throw new Error(`Release ${release.version}: expected one asset ${name}, found ${matches.length}`);
  }
  const [asset] = matches;
  const match = sha256Digest.exec(asset.digest ?? "");
  if (match === null) {
    throw new Error(`Release ${release.version}: asset ${name} has no sha256 digest (${asset.digest ?? "none"})`);
  }
  return { url: asset.url, sha256: match[1] };
};

/** The `<major>.<minor>`, `<major>` and `latest` names a release claims. */
export const versionAliases = (release: TrackedRelease): string[] => {
  const [major, minor] = release.number;
  return [`${major}.${minor}`, `${major}`, "latest"];
};
