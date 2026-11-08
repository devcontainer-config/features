import { codeServer } from "./code-server/feature.js";
import { dotnet } from "./dotnet/feature.js";
import type { Feature } from "./feature.js";
import { ripgrep } from "./ripgrep/feature.js";
import { uv } from "./uv/feature.js";

export const features: Readonly<Record<"code-server" | "dotnet" | "ripgrep" | "uv", Feature>> = {
  "code-server": codeServer,
  dotnet,
  ripgrep,
  uv,
};
