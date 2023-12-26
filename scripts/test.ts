import path from "node:path";

import { projectRoot } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

const tag = "devcontainer";
await $$`docker build --tag ${tag} ${path.resolve(projectRoot, ".devcontainer")}`;
await $$`devcontainer features test ${[
  "--project-folder",
  path.resolve(projectRoot, ".devcontainer/features"),
  "--base-image",
  tag,
]}`;
