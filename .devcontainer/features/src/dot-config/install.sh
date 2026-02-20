#!/bin/sh
set -e

export npm_config_resolution_mode=time-based
export npm_config_inject_workspace_packages=true
export npm_config_global_bin_dir=/usr/local/bin
pnpm install
pnpm run install-feature
