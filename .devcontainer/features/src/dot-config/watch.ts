import path from "node:path";

import chokidar from "chokidar";
import winston from "winston";

import { getDotConfigJsonPath, parseConfig } from "./config.js";
import { syncFile } from "./sync.js";

export const watch = (projectRoot: string) => {
  let watchers: chokidar.FSWatcher[] = [];
  const initializeWatchers = async () => {
    try {
      const newWatchers: chokidar.FSWatcher[] = [];
      const mappings = await parseConfig(projectRoot);
      for (const { sourcePath, targetPath } of mappings) {
        const watcher = chokidar.watch([sourcePath, targetPath]).on("all", (eventName, path) => {
          if (eventName === "add" || eventName === "change" || eventName === "unlink") {
            void (async () => {
              try {
                const direction = path === sourcePath ? "->" : "<-";
                winston.info(`[${eventName}] ${sourcePath} ${direction} ${targetPath}`);
                const eventSource = path === sourcePath ? "source" : "target";
                await syncFile(sourcePath, targetPath, eventSource, eventName);
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
      void initializeWatchers();
    }
  });
  chokidar.watch(path.resolve(projectRoot, ".config"), { ignoreInitial: true }).on("addDir", () => {
    void initializeWatchers();
  });
};
