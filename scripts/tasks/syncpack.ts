import { $$ } from "@/scripts/shell.js";

export const syncpackLint = () => $$`syncpack lint-mismatches`;

export const syncpackFix = () => $$`syncpack fix-mismatches`;
