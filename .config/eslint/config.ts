import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import { gitignore } from "eslint-flat-config-gitignore";
import importX from "eslint-plugin-import-x";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tsESLint from "typescript-eslint";

export default defineConfig(
  await gitignore(import.meta.dirname),
  {
    linterOptions: { reportUnusedDisableDirectives: true },
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    extends: [...tsESLint.configs.recommendedTypeChecked, ...tsESLint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/*.test.{ts,tsx,cts,mts}"],
    extends: [vitest.configs.recommended],
  },
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      unicorn: eslintPluginUnicorn,
      "import-x": importX,
    },
    rules: {
      "import-x/no-extraneous-dependencies": "error",
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
