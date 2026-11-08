#!/bin/sh
# Install the `features` Feature: stage the dispatcher, persist the resolved
# features path, prepare the features and state directories, then run every
# staged feature's install executable.

# spell-checker:ignore FEATURESPATH

set -e

prefix=/opt/devcontainer-config
state_path=/var/lib/devcontainer-config/features

FEATURES_PATH=${FEATURESPATH:-/opt/devcontainer-config/features}

case $FEATURES_PATH in
  /*) ;;
  *) echo "install.sh: featuresPath must be an absolute path, got: $FEATURES_PATH" >&2 && exit 1 ;;
esac

mkdir -p "$prefix"
install -m 0755 ./features-run "$prefix/features-run"

printf '%s\n' "$FEATURES_PATH" > "$prefix/features-path"

mkdir -p "$FEATURES_PATH" "$state_path"
chmod a+rwx "$state_path"

exec "$prefix/features-run" install
