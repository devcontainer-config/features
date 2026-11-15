// spell-checker:ignore tlog
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Bundle, BundleVerifier } from "sigstore";
import { createVerifier } from "sigstore";
import { z } from "zod";

import { githubApiHeaders } from "./github.js";
import { uncompress } from "./snappy.js";

const releasePredicateType = "https://in-toto.io/attestation/release/v0.2";
const slsaPredicateType = "https://slsa.dev/provenance/v1";
const releaseIdentity = "https://dotcom.releases.github.com";
const githubActionsIssuer = "https://token.actions.githubusercontent.com";
const releaseMirrorURL = "https://tuf-repo.github.com";
const slsaMirrorURL = "https://tuf-repo-cdn.sigstore.dev";

const bundleSchema = z.looseObject({
  mediaType: z.string(),
  dsseEnvelope: z.looseObject({ payload: z.string(), payloadType: z.string() }),
});

const attestationEntrySchema = z.looseObject({ bundle_url: z.string() });

const attestationsSchema = z.object({ attestations: z.array(attestationEntrySchema) });

const statementTypeSchema = z.looseObject({ predicateType: z.string() });

const releaseStatementSchema = z.looseObject({
  predicateType: z.literal(releasePredicateType),
  subject: z.array(
    z.looseObject({ name: z.string().optional(), digest: z.looseObject({ sha256: z.string().optional() }) }),
  ),
  predicate: z.looseObject({ repository: z.string(), tag: z.string(), purl: z.string() }),
});

const slsaStatementSchema = z.looseObject({
  predicateType: z.literal(slsaPredicateType),
  subject: z.array(z.looseObject({ digest: z.looseObject({ sha256: z.string().optional() }) })),
});

type AttestationEntry = z.infer<typeof attestationEntrySchema>;
type ReleaseStatement = z.infer<typeof releaseStatementSchema>;

interface Policy {
  mirrorURL: string;
  identity: string;
  issuer?: string;
  tlogThreshold?: number;
  ctLogThreshold?: number;
}

const releasePolicy: Policy = {
  mirrorURL: releaseMirrorURL,
  identity: releaseIdentity,
  tlogThreshold: 0,
  ctLogThreshold: 0,
};

const slsaPolicy = (identity: string): Policy => ({
  mirrorURL: slsaMirrorURL,
  identity,
  issuer: githubActionsIssuer,
});

export interface AttestationTarget {
  repository: string;
  sha256: string;
  url: string;
  tag: string;
  purl: string;
  identity: string;
}

export interface Attestations {
  verify(target: AttestationTarget): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const describe = (target: AttestationTarget, predicateType: string): string =>
  `${target.repository} sha256:${target.sha256} ${predicateType}`;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const assetName = (url: string): string => {
  const name = new URL(url).pathname.split("/").at(-1);
  if (name === undefined || name === "") {
    throw new Error(`${url}: the URL carries no file name`);
  }
  return decodeURIComponent(name);
};

const statementOf = (bundle: Bundle, source: string): unknown => {
  const envelope = bundle.dsseEnvelope;
  if (envelope === undefined) {
    throw new Error(`${source}: the bundle has no DSSE envelope`);
  }
  try {
    return JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8")) as unknown;
  } catch (error) {
    throw new Error(`${source}: the DSSE payload is not JSON: ${messageOf(error)}`, { cause: error });
  }
};

const bundleOf = async (entry: AttestationEntry, source: string, index: number): Promise<Bundle> => {
  const url = entry.bundle_url;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${source}: attestation ${index}: GET ${url} → HTTP ${response.status}`);
  }
  try {
    const json: unknown = JSON.parse(
      Buffer.from(uncompress(new Uint8Array(await response.arrayBuffer()))).toString("utf8"),
    );
    return bundleSchema.parse(json) as Bundle;
  } catch (error) {
    throw new Error(`${source}: attestation ${index}: cannot decode the bundle at ${url}: ${messageOf(error)}`, {
      cause: error,
    });
  }
};

const assertReleaseClaims = (statement: ReleaseStatement, target: AttestationTarget, source: string): void => {
  const { predicate } = statement;
  if (predicate.repository !== target.repository) {
    throw new Error(`${source}: release repository ${predicate.repository} does not match ${target.repository}`);
  }
  if (predicate.tag !== target.tag) {
    throw new Error(`${source}: release tag ${predicate.tag} does not match ${target.tag}`);
  }
  if (predicate.purl !== target.purl) {
    throw new Error(`${source}: release purl ${predicate.purl} does not match ${target.purl}`);
  }
  const name = assetName(target.url);
  if (!statement.subject.some((subject) => subject.name === name && subject.digest.sha256 === target.sha256)) {
    throw new Error(`${source}: no subject names ${name} with sha256 ${target.sha256}`);
  }
};

export const createAttestations = async (): Promise<Attestations> => {
  const cachePath = await mkdtemp(path.join(tmpdir(), "devcontainer-attestations-"));
  const verifiers = new Map<string, Promise<BundleVerifier>>();

  const anchorOf = async (policy: Policy, key: string): Promise<string> => {
    const url = `${policy.mirrorURL}/1.root.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GET ${url} → HTTP ${response.status}`);
    }
    const anchorPath = path.join(cachePath, "anchors", `${createHash("sha256").update(key).digest("hex")}.json`);
    await mkdir(path.dirname(anchorPath), { recursive: true });
    await writeFile(anchorPath, new Uint8Array(await response.arrayBuffer()));
    return anchorPath;
  };

  const verifierFor = (policy: Policy): Promise<BundleVerifier> => {
    const key = JSON.stringify([
      policy.mirrorURL,
      policy.identity,
      policy.issuer,
      policy.tlogThreshold,
      policy.ctLogThreshold,
    ]);
    let verifier = verifiers.get(key);
    if (verifier === undefined) {
      verifier = (async () => {
        const anchorPath = await anchorOf(policy, key);
        return createVerifier({
          tufMirrorURL: policy.mirrorURL,
          tufRootPath: anchorPath,
          tufCachePath: cachePath,
          certificateIdentityURI: `^${escapeRegExp(policy.identity)}$`,
          ...(policy.issuer === undefined ? {} : { certificateIssuer: policy.issuer }),
          ...(policy.tlogThreshold === undefined ? {} : { tlogThreshold: policy.tlogThreshold }),
          ...(policy.ctLogThreshold === undefined ? {} : { ctLogThreshold: policy.ctLogThreshold }),
        });
      })();
      verifiers.set(key, verifier);
    }
    return verifier;
  };

  const verify = async (target: AttestationTarget): Promise<void> => {
    const url = `https://api.github.com/repos/${target.repository}/attestations/sha256:${target.sha256}`;
    const response = await fetch(url, { headers: githubApiHeaders() });
    if (!response.ok) {
      throw new Error(`GET ${url} → HTTP ${response.status}`);
    }
    const parsed = attestationsSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(`GET ${url}: ${z.prettifyError(parsed.error)}`);
    }

    let releaseStatements = 0;
    let slsaStatements = 0;
    for (const [index, entry] of parsed.data.attestations.entries()) {
      const bundle = await bundleOf(entry, url, index);
      const type = statementTypeSchema.safeParse(statementOf(bundle, `${url}: attestation ${index}`));
      if (!type.success) {
        throw new Error(`${url}: attestation ${index} has no predicateType`);
      }
      if (type.data.predicateType === releasePredicateType) {
        const source = `${describe(target, releasePredicateType)}: attestation ${index}`;
        const statement = releaseStatementSchema.safeParse(statementOf(bundle, source));
        if (!statement.success) {
          throw new Error(`${source}: ${z.prettifyError(statement.error)}`);
        }
        try {
          await Promise.resolve((await verifierFor(releasePolicy)).verify(bundle));
        } catch (error) {
          throw new Error(`${source}: verification failed: ${messageOf(error)}`, { cause: error });
        }
        assertReleaseClaims(statement.data, target, source);
        releaseStatements++;
      } else if (type.data.predicateType === slsaPredicateType) {
        const source = `${describe(target, slsaPredicateType)}: attestation ${index}`;
        const statement = slsaStatementSchema.safeParse(statementOf(bundle, source));
        if (!statement.success) {
          throw new Error(`${source}: ${z.prettifyError(statement.error)}`);
        }
        try {
          await Promise.resolve((await verifierFor(slsaPolicy(target.identity))).verify(bundle));
        } catch (error) {
          throw new Error(`${source}: verification failed: ${messageOf(error)}`, { cause: error });
        }
        if (!statement.data.subject.some((subject) => subject.digest.sha256 === target.sha256)) {
          throw new Error(`${source}: no subject carries sha256 ${target.sha256}`);
        }
        slsaStatements++;
      }
    }
    if (releaseStatements === 0) {
      throw new Error(`${url}: no release attestation`);
    }
    if (slsaStatements === 0) {
      throw new Error(`${url}: no SLSA v1 provenance attestation`);
    }
  };

  return {
    verify,
    async [Symbol.asyncDispose]() {
      await rm(cachePath, { recursive: true, force: true });
    },
  };
};
