import path from "node:path";

import { projectRoot, workspaces } from "@/scripts/project.js";

import type { Rid } from "../architecture.js";
import { ensureFeatureBinary } from "../featureBinary.js";

const csproj = path.resolve(projectRoot, "features/code-server/Feature/Feature.csproj");

const packPath = (rid: Rid): string => path.join(workspaces, "bin/code-server/Feature", rid);

export const packFeatureBinary = (rid: Rid, force: boolean): Promise<string> =>
  ensureFeatureBinary(csproj, packPath(rid), rid, force);
