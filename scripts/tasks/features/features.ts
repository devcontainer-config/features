import { codeServer } from "./code-server/feature.js";
import { dotnet } from "./dotnet/feature.js";
import type { Feature } from "./feature.js";
import { githubCli } from "./github-cli/feature.js";
import { ripgrep } from "./ripgrep/feature.js";
import { uv } from "./uv/feature.js";

export const features: Readonly<Record<"code-server" | "dotnet" | "github-cli" | "ripgrep" | "uv", Feature>> = {
  "code-server": codeServer,
  dotnet,
  "github-cli": githubCli,
  ripgrep,
  uv,
};
