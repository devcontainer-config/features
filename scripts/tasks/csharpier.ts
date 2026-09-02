import { projectRoot } from "@/scripts/project.js";
import { project$$ } from "@/scripts/shell.js";

export const csharpierCheck = () => project$$`dotnet csharpier check ${projectRoot}`;

export const csharpierFix = () => project$$`dotnet csharpier format ${projectRoot}`;
