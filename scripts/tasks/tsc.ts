import { glob } from "glob";

import { projectRoot } from "@/scripts/project.js";
import { $$ } from "@/scripts/shell.js";

export const typeCheck = async () => {
  const projects = await glob(`${projectRoot}/**/tsconfig.json`, { ignore: ["**/node_modules/**"], dot: true });
  await Promise.all(projects.map((project) => $$`tsc --project ${project} --noEmit`));
};
