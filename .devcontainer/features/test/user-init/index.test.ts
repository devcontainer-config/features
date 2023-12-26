import { R_OK, W_OK, X_OK } from "node:constants";
import { access } from "node:fs/promises";

import { expect, test } from "vitest";

test("uid", () => {
  expect(process.getuid?.()).toBe(1000);
});

test("XDG base directories", async () => {
  const userName = process.env.USER;
  expect(userName).toBeDefined();

  await access(`/home/${userName}/.config`, R_OK | W_OK | X_OK);
  await access(`/home/${userName}/.cache`, R_OK | W_OK | X_OK);
  await access(`/home/${userName}/.local/share`, R_OK | W_OK | X_OK);
  await access(`/home/${userName}/.local/state`, R_OK | W_OK | X_OK);
});
