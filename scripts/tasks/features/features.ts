import { dotnet } from "./dotnet/feature.js";
import type { Feature } from "./feature.js";
import { ripgrep } from "./ripgrep/feature.js";
import { uv } from "./uv/feature.js";

export const features: Readonly<Record<"dotnet" | "ripgrep" | "uv", Feature>> = { dotnet, ripgrep, uv };
