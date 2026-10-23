import type { Bundle, BundleVerifier } from "sigstore";
import { createVerifier } from "sigstore";
import { z } from "zod";

const predicateTypeSlsaV1 = "https://slsa.dev/provenance/v1";
const certificateIssuer = "https://token.actions.githubusercontent.com";

const statementSchema = z.object({
  predicateType: z.string(),
  subject: z.array(z.object({ digest: z.object({ sha256: z.string() }) })),
});

const attestationsSchema = z.object({
  attestations: z.array(
    z.object({
      bundle: z.looseObject({
        mediaType: z.string(),
        dsseEnvelope: z.looseObject({ payload: z.string(), payloadType: z.string() }),
      }),
    }),
  ),
});

const verifiers = new Map<string, Promise<BundleVerifier>>();

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const verifierFor = (slug: string): Promise<BundleVerifier> => {
  let verifier = verifiers.get(slug);
  if (verifier === undefined) {
    const identity = escapeRegExp(`https://github.com/${slug}/.github/workflows/release.yml@refs/heads/main`);
    verifier = createVerifier({ certificateIssuer, certificateIdentityURI: `^${identity}$` });
    verifiers.set(slug, verifier);
  }
  return verifier;
};

const decodeStatement = (envelope: { payload: string }): unknown =>
  JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));

export const verifyAttestation = async (slug: string, sha256: string): Promise<void> => {
  const url = `https://api.github.com/repos/${slug}/attestations/sha256:${sha256}`;
  const response = await fetch(url, { headers: { accept: "application/vnd.github+json" } });
  if (!response.ok) {
    throw new Error(`GET ${url} → HTTP ${response.status}`);
  }
  const result = attestationsSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error(`GET ${url}: ${z.prettifyError(result.error)}`);
  }
  const provenance = result.data.attestations.flatMap(({ bundle }) => {
    const statement = statementSchema.safeParse(decodeStatement(bundle.dsseEnvelope));
    return statement.success && statement.data.predicateType === predicateTypeSlsaV1
      ? [{ bundle, statement: statement.data }]
      : [];
  });
  if (provenance.length === 0) {
    throw new Error(`${url}: no SLSA v1 provenance attestation`);
  }
  const verifier = await verifierFor(slug);
  for (const { bundle, statement } of provenance) {
    // The API returns the serialized bundle exactly as sigstore's verifier takes it; the verifier fully validates
    // the shape when it parses the bundle.
    verifier.verify(bundle as Bundle);
    if (!statement.subject.some((subject) => subject.digest.sha256 === sha256)) {
      throw new Error(`${url}: no statement subject carries sha256 ${sha256}`);
    }
  }
};
