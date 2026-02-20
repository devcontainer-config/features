import { $$ } from "@/scripts/shell.js";

export const syncpackLint = () => $$`syncpack list`;

export const syncpackFix = () => $$`syncpack fix`;
