import { createRequire } from "node:module";

import type pkg from "./package.json";

const require = createRequire(import.meta.url);
export const packageJson = {
  ...(require("./package.json") as typeof pkg),
  bin: "./index.js",
};
