import { R_OK, W_OK, X_OK } from "node:constants";
import { access, stat } from "node:fs/promises";
import { userInfo } from "node:os";

import { expect, test } from "vitest";

test("remote user home", async () => {
  const { username, uid, gid, homedir } = userInfo();

  expect(homedir).toBe(`/home/${username}`);

  const home = await stat(homedir);
  expect(home.uid).toBe(uid);
  expect(home.gid).toBe(gid);
});

test("XDG base directories", async () => {
  const { username } = userInfo();
  const roots = {
    XDG_CONFIG_HOME: "/etc/devcontainer-config",
    XDG_CACHE_HOME: "/var/cache/devcontainer-config",
    XDG_DATA_HOME: "/usr/share/devcontainer-config",
    XDG_STATE_HOME: "/var/lib/devcontainer-config",
  } as const;

  for (const [name, root] of Object.entries(roots)) {
    const directory = `${root}/${username}`;
    expect(process.env[name]).toBe(directory);
    await access(directory, R_OK | W_OK | X_OK);
  }
});
