import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import type { Linter } from "eslint";
import prettier from "eslint-config-prettier";
import { gitignore } from "eslint-flat-config-gitignore";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  await gitignore(__dirname),
  {
    languageOptions: { globals: globals.node },
    linterOptions: { reportUnusedDisableDirectives: true },
  },
  js.configs.recommended,
  ...compat.config({
    overrides: [
      {
        files: ["*.{ts,tsx,cts,mts}"],
        extends: [
          "plugin:@typescript-eslint/recommended-type-checked",
          "plugin:@typescript-eslint/stylistic-type-checked",
        ],
        parserOptions: { project: true, tsConfigRootDir: __dirname },
        rules: {
          "@typescript-eslint/consistent-type-exports": "error",
          "@typescript-eslint/consistent-type-imports": "error",
        },
      },
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
] satisfies Linter.FlatConfig[];
