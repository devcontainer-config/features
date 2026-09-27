import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

import type { StartedCommand } from "./lifecycle.js";

const timeoutMs = 30_000;
const intervalMs = 100;

export interface Serve {
  command: readonly string[];
  socketPath: string;
  expectedBody: string;
}

interface Response {
  statusCode: number | undefined;
  body: string;
}

const attempt = (socketPath: string): Promise<Response | undefined> =>
  new Promise((resolve, reject) => {
    const call = request({ socketPath, path: "/", method: "GET" }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString() });
      });
    });
    call.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        resolve(undefined);
        return;
      }
      reject(error);
    });
    call.end();
  });

const detail = (text: string): string => (text.trim() === "" ? "" : `\n${text.trimEnd()}`);

const assertResponse = async (server: StartedCommand, { socketPath, expectedBody }: Serve): Promise<void> => {
  const deadline = performance.now() + timeoutMs;
  while (true) {
    if (server.hasExited()) {
      throw new Error(`${server.command.join(" ")} exited before it served ${socketPath}${detail(server.output())}`);
    }
    const response = await attempt(socketPath);
    if (response !== undefined) {
      if (response.statusCode !== 200) {
        throw new Error(`GET ${socketPath} returned HTTP ${String(response.statusCode)} — expected 200`);
      }
      if (response.body !== expectedBody) {
        throw new Error(
          `GET ${socketPath} returned ${JSON.stringify(response.body)} — expected ${JSON.stringify(expectedBody)}`,
        );
      }
      return;
    }
    if (performance.now() >= deadline) {
      throw new Error(`GET ${socketPath} did not answer within ${timeoutMs} ms${detail(server.output())}`);
    }
    await delay(intervalMs);
  }
};

export const serve = { assertResponse } as const;
