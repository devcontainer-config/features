import path from "node:path";

import winston from "winston";

import { cachePath } from "./config.js";

export const initializeLogger = () => {
  winston.configure({
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        handleExceptions: true,
        handleRejections: true,
      }),
      new winston.transports.File({
        filename: path.resolve(cachePath, "dot-config.log"),
        options: { flags: "w" },
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
  });
};
