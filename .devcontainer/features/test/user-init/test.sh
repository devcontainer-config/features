#!/bin/bash
set -e

rm -rf node_modules
pnpm install
pnpm run test run
