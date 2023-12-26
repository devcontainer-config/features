import { mkdir } from "node:fs/promises";
import path from "node:path";

import winston from "winston";

export const initializeLogger = async () => {
  const cacheHome = process.env.XDG_CACHE_HOME ?? `${process.env.HOME}/.cache`;
  const cacheDir = path.resolve(cacheHome, "devcontainer-config");
  await mkdir(cacheDir, { recursive: true });
  winston.configure({
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        handleExceptions: true,
        handleRejections: true,
      }),
      new winston.transports.File({
        filename: path.resolve(cacheDir, "dot-config.log"),
        options: { flags: "w" },
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
  });
};
