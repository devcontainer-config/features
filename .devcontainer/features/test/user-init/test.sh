#!/bin/bash
set -e

corepack install
pnpm install
pnpm run test run
