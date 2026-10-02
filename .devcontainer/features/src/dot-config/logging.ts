import { homedir } from "node:os";
import path from "node:path";

import winston from "winston";

const cacheRoot = (): string => {
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  const cacheHome =
    xdgCacheHome !== undefined && xdgCacheHome !== "" && path.isAbsolute(xdgCacheHome)
      ? xdgCacheHome
      : path.join(homedir(), ".cache");
  return path.join(cacheHome, "dot-config");
};

export const initializeLogger = () => {
  winston.configure({
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        handleExceptions: true,
        handleRejections: true,
      }),
      new winston.transports.File({
        filename: path.join(cacheRoot(), "dot-config.log"),
        options: { flags: "w" },
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
  });
};
