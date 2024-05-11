#!/bin/sh
set -e

PNPM=pnpm@latest-9

export npm_config_resolution_mode=time-based
npx --yes ${PNPM} install
npx --yes ${PNPM} run install-feature
