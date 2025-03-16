import path from "node:path";

import type { FSWatcher } from "chokidar";
import chokidar from "chokidar";
import winston from "winston";

import { getDotConfigJsonPath, parseConfig } from "./config.js";
import { createAsyncLock } from "./lock.js";
import { syncFile } from "./sync.js";

export const watch = (projectRoot: string) => {
  const lock = createAsyncLock();

  let watchers: FSWatcher[] = [];
  const initializeWatchers = async () => {
    try {
      const newWatchers: FSWatcher[] = [];
      const mappings = await parseConfig(projectRoot);
      for (const { sourcePath, targetPath } of mappings) {
        const watcher = chokidar.watch([sourcePath, targetPath]).on("all", (eventName, path) => {
          if (eventName === "add" || eventName === "change" || eventName === "unlink") {
            void (async () => {
              try {
                const direction = path === sourcePath ? "->" : "<-";
                winston.info(`[${eventName}] ${sourcePath} ${direction} ${targetPath}`);
                const eventSource = path === sourcePath ? "source" : "target";
                await lock.invoke(() => syncFile(sourcePath, targetPath, eventSource, eventName));
              } catch (error) {
                winston.error("syncFile:", error);
              }
            })();
          }
        });
        newWatchers.push(watcher);
      }

      const oldWatchers = watchers;
      watchers = newWatchers;
      for (const watcher of oldWatchers) {
        await watcher.close();
      }
    } catch (error) {
      winston.error("initializeWatchers:", error);
    }
  };

  chokidar.watch(getDotConfigJsonPath(projectRoot)).on("all", (eventName) => {
    if (eventName === "add" || eventName === "change") {
      void lock.invoke(() => initializeWatchers());
    }
  });
  chokidar.watch(path.resolve(projectRoot, ".config"), { ignoreInitial: true }).on("addDir", () => {
    void lock.invoke(() => initializeWatchers());
  });
};
