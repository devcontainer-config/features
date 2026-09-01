#!/bin/sh
# Scenario features_staged: three features staged at the default features
# path exercise the dispatcher end to end - discovery, installsAfter ordering,
# the dangling declaration, every hook, the entrypoint and the state root.
set -e

scenario_name=features_staged
. "$(dirname "$0")/features_test_lib.sh"

default_path=/opt/devcontainer-config/features

# install hooks ran at image build time; beta first (declared by alpha), then
# name order for the unbound ones.
assert_order install "$install_log" "20-beta 30-gamma 10-alpha"
assert_path "$install_log" "$default_path"

# entrypoints ran as the container's start script; 30-gamma declares none.
wait_for_lines "$entrypoint_log" 2 || fail "entrypoint log incomplete: $(cat "$entrypoint_log" 2> /dev/null)"
assert_order entrypoint "$entrypoint_log" "20-beta 10-alpha"
assert_path "$entrypoint_log" "$default_path"

# the five lifecycle hooks ran in lifecycle order, in the resolved order.
for hook in onCreate updateContent postCreate postStart postAttach; do
  assert_order "$hook" "$hooks_log" "20-beta 30-gamma 10-alpha"
done
assert_path "$hooks_log" "$default_path"

assert_persisted_path "$default_path"
for id in 10-alpha 20-beta 30-gamma; do
  assert_hooks_logged "$id" "onCreate updateContent postCreate postStart postAttach"
done

assert_init_pid1

# .shared is a dot-directory: it is staged but never treated as a feature.
if [ ! -f "$default_path/.shared/log.sh" ]; then
  fail "the staged dot-directory is missing under $default_path"
fi
if grep -q shared "$install_log" "$entrypoint_log" "$hooks_log"; then
  fail "the .shared dot-directory was treated as a feature"
fi
