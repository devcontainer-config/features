import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const download = async (url: string, destination: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} → HTTP ${response.status}`);
  }
  if (response.body === null) {
    throw new Error(`GET ${url}: no response body`);
  }
  const hash = createHash("sha256");
  const digest = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), digest, createWriteStream(destination));
  return hash.digest("hex");
};
