import { R_OK, W_OK, X_OK } from "node:constants";
import { access, readFile, stat } from "node:fs/promises";

import { $ } from "execa";
import { expect, test } from "vitest";

const featuresRun = "/opt/devcontainer-config/features-run";
const featuresPathFile = "/opt/devcontainer-config/features-path";
const hooks = ["install", "entrypoint", "onCreate", "updateContent", "postCreate", "postStart", "postAttach"] as const;

test("dispatcher is installed as an executable file", async () => {
  const stats = await stat(featuresRun);
  expect(stats.isFile()).toBe(true);
  expect(stats.mode & 0o755).toBe(0o755);
  await access(featuresRun, R_OK | X_OK);
});

test("features path file holds the default features path", async () => {
  const text = await readFile(featuresPathFile, "utf-8");
  expect(text).toBe("/opt/devcontainer-config/features\n");
});

test("unknown or missing hook exits 1", async () => {
  const $$ = $({ reject: false });
  const unknown = await $$`${featuresRun} nonsense`;
  expect(unknown.exitCode).toBe(1);
  const missing = await $$`${featuresRun}`;
  expect(missing.exitCode).toBe(1);
});

test("every hook exits 0 with no features staged", async () => {
  const $$ = $({ reject: false, verbose: "short" });
  for (const hook of hooks) {
    const result = await $$`${featuresRun} ${hook}`;
    expect(result.exitCode).toBe(0);
  }
});

test("state root exists as a writable directory", async () => {
  const stateRoot = "/var/lib/devcontainer-config/features";
  const stats = await stat(stateRoot);
  expect(stats.isDirectory()).toBe(true);
  await access(stateRoot, R_OK | W_OK | X_OK);
});
