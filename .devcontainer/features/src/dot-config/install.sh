#!/bin/sh
set -e

PNPM=pnpm@latest-10

export npm_config_resolution_mode=time-based
export npm_config_inject_workspace_packages=true
npx --yes ${PNPM} install
npx --yes ${PNPM} run install-feature
