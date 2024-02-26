import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import { gitignore } from "eslint-flat-config-gitignore";
import globals from "globals";
import tsESLint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default tsESLint.config(
  await gitignore(__dirname),
  {
    languageOptions: { globals: globals.node },
    linterOptions: { reportUnusedDisableDirectives: true },
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    extends: [...tsESLint.configs.recommendedTypeChecked, ...tsESLint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { project: true, tsConfigRootDir: __dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  ...compat.config({
    overrides: [
      {
        files: ["*.test.{ts,tsx,cts,mts}"],
        extends: ["plugin:vitest/recommended"],
      },
    ],
  }),
  ...compat.plugins("import", "simple-import-sort", "unicorn"),
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    rules: {
      "import/no-extraneous-dependencies": "error",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
      "unicorn/prefer-node-protocol": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: { "unicorn/prefer-module": "error" },
  },
  prettier,
);
