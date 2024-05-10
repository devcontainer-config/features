#!/bin/sh
set -e

PNPM=pnpm@latest-9

npx --yes ${PNPM} install
npx --yes ${PNPM} run install-feature
