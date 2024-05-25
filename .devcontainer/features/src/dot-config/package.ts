import { createRequire } from "node:module";

import type devcontainerFeature from "./devcontainer-feature.json";
import type pkg from "./package.json";

const require = createRequire(import.meta.url);
const devcontainerFeatureJson = require("./devcontainer-feature.json") as typeof devcontainerFeature;
export const packageJson = {
  ...(require("./package.json") as typeof pkg),
  version: devcontainerFeatureJson.version,
  bin: "./index.js",
};
