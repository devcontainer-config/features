#!/bin/sh
# Scenario features_custom_path: the same orchestration, with the consumer
# staging into a custom featuresPath.
set -e

scenario_name=features_custom_path
. "$(dirname "$0")/features_test_lib.sh"

custom_path=/opt/custom-features

assert_order install "$install_log" "20-beta 10-alpha"
assert_order onCreate "$hooks_log" "20-beta 10-alpha"
assert_path "$install_log" "$custom_path"
assert_path "$hooks_log" "$custom_path"

assert_persisted_path "$custom_path"
for id in 10-alpha 20-beta; do
  assert_hooks_logged "$id" "onCreate"
done

assert_init_pid1
