#!/bin/sh
set -e

export pnpm_config_resolution_mode=time-based
export pnpm_config_inject_workspace_packages=true
export pnpm_config_lockfile=false
export pnpm_config_strict_dep_builds=false
pnpm install
pnpm run install-feature
