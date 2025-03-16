import { R_OK, W_OK, X_OK } from "node:constants";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { $ } from "execa";
import { expect, test } from "vitest";

test("workspace access", async () => {
  const workspacesPath = process.env.WORKSPACES ?? "/workspaces";
  await access(workspacesPath, R_OK | W_OK | X_OK);
  expect(true).toBe(true);
});

test("dot-config sync", async () => {
  const tempPath = path.resolve(tmpdir(), "workspaces-sync/test");
  await mkdir(path.resolve(tempPath, ".devcontainer"), { recursive: true });
  await mkdir(path.resolve(tempPath, ".config/test"), { recursive: true });
  const $$ = $({ stdio: "inherit", verbose: "full", cwd: tempPath });

  await writeFile(
    path.resolve(tempPath, ".devcontainer/dot-config.json"),
    JSON.stringify({
      test: {
        "test.txt": "test.txt",
      },
    }),
  );
  await writeFile(path.resolve(tempPath, ".config/test/test.txt"), "test1");
  await $$`dot-config sync`;
  const text1 = await readFile(path.resolve(tempPath, "../test.txt"), "utf-8");
  expect(text1).toBe("test1");

  await writeFile(path.resolve(tempPath, ".config/test/test.txt"), "test2");
  await $$`dot-config sync`;
  const text2 = await readFile(path.resolve(tempPath, "../test.txt"), "utf-8");
  expect(text2).toBe("test2");

  await writeFile(path.resolve(tempPath, "../test.txt"), "text3");
  await $$`dot-config sync`;
  const text3 = await readFile(path.resolve(tempPath, ".config/test/test.txt"), "utf-8");
  expect(text3).toBe("test2");
});

const waitFor = <T>(callback: () => T | Promise<T>, timeout = 1000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeout);
    const check = async () => {
      try {
        const result = await callback();
        clearTimeout(timer);
        resolve(result);
      } catch {
        setTimeout(() => void check(), 100);
      }
    };
    void check();
  });
};

test("dot-config watch", async () => {
  const tempPath = path.resolve(tmpdir(), "workspaces-watch/test");
  await mkdir(path.resolve(tempPath, ".devcontainer"), { recursive: true });
  await mkdir(path.resolve(tempPath, ".config/test"), { recursive: true });
  const $$ = $({ stdio: "inherit", verbose: "full", cwd: tempPath });

  await writeFile(
    path.resolve(tempPath, ".devcontainer/dot-config.json"),
    JSON.stringify({
      test: {
        "test.txt": "test.txt",
      },
    }),
  );
  const watch = $$`dot-config watch`;

  await writeFile(path.resolve(tempPath, ".config/test/test.txt"), "test1");
  await waitFor(async () => {
    const text1 = await readFile(path.resolve(tempPath, "../test.txt"), "utf-8");
    expect(text1).toBe("test1");
  });

  await writeFile(path.resolve(tempPath, ".config/test/test.txt"), "test2");
  await waitFor(async () => {
    const text2 = await readFile(path.resolve(tempPath, "../test.txt"), "utf-8");
    expect(text2).toBe("test2");
  });

  await writeFile(path.resolve(tempPath, "../test.txt"), "test3");
  await waitFor(async () => {
    const text3 = await readFile(path.resolve(tempPath, ".config/test/test.txt"), "utf-8");
    expect(text3).toBe("test3");
  });

  await writeFile(path.resolve(tempPath, ".config/test/test1.txt"), "test");
  await writeFile(
    path.resolve(tempPath, ".devcontainer/dot-config.json"),
    JSON.stringify({
      test: {
        "test.txt": "test.txt",
        "test1.txt": "test1.txt",
      },
    }),
  );
  await waitFor(async () => {
    const text = await readFile(path.resolve(tempPath, "../test1.txt"), "utf-8");
    expect(text).toBe("test");
  });

  watch.kill();
  await watch.catch(() => ({}));
});
