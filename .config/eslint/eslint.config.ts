import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import { gitignore } from "eslint-flat-config-gitignore";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import vitest from "eslint-plugin-vitest";
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
  {
    files: ["**/*.test.{ts,tsx,cts,mts}"],
    extends: [vitest.configs.recommended],
  },
  ...compat.plugins("import"),
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      unicorn: eslintPluginUnicorn,
    },
    rules: {
      "import/no-extraneous-dependencies": "error",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
      "unicorn/prefer-node-protocol": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,mts}"],
    plugins: { unicorn: eslintPluginUnicorn },
    rules: { "unicorn/prefer-module": "error" },
  },
  prettier,
);
