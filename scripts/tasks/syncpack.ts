import { $$ } from "@/scripts/shell.js";

export const syncpackLint = () => $$`syncpack list-mismatches`;

export const syncpackFix = () => $$`syncpack fix-mismatches`;
