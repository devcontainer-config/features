import { R_OK, W_OK, X_OK } from "node:constants";
import { access } from "node:fs/promises";

import { expect, test } from "vitest";

test("uid", () => {
  expect(process.getuid?.()).toBe(1000);
});

test("XDG base directories", async () => {
  await access("/etc/devcontainer-config", R_OK | W_OK | X_OK);
  await access("/var/cache/devcontainer-config", R_OK | W_OK | X_OK);
  await access("/usr/share/devcontainer-config", R_OK | W_OK | X_OK);
  await access("/var/lib/devcontainer-config", R_OK | W_OK | X_OK);
  expect(true).toBe(true);
});
