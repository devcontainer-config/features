import path from "node:path";

import { workspaces } from "@/scripts/project.js";

import type { Rid } from "../architecture.js";

export type Assembly = "Build" | "Feature";

export const packPath = (assembly: Assembly, rid: Rid): string => path.join(workspaces, "bin/dotnet", assembly, rid);
