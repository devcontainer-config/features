#!/bin/sh
set -e

PNPM_TAG=latest-10
PNPM_PATH=/tmp/devcontainer-config-dot-config-pnpm

mkdir --parents ${PNPM_PATH}
npm install --prefix ${PNPM_PATH} --global pnpm@${PNPM_TAG}
export npm_config_resolution_mode=time-based
export npm_config_inject_workspace_packages=true
export npm_config_global_bin_dir=/usr/local/bin
${PNPM_PATH}/bin/pnpm install
${PNPM_PATH}/bin/pnpm run install-feature
rm --recursive ${PNPM_PATH}
