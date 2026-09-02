import { project$$ } from "@/scripts/shell.js";

export const dotnetFormatCheck = () => project$$`dotnet msbuild . -t:GetTargetPath -p:DotNetFormatCheck=true`;

export const dotnetFormat = () => project$$`dotnet msbuild . -t:GetTargetPath -p:DotNetFormat=true`;
