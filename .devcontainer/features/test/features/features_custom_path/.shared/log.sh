state_root=/var/lib/devcontainer-config/features

if [ -z "${FEATURES_PATH:-}" ] \
  || [ "$FEATURES_DIR" != "$FEATURES_PATH/$FEATURES_ID" ]; then
  echo "demo feature '$FEATURES_ID': unexpected FEATURES_* environment" >&2
  exit 1
fi

log_install() {
  printf '%s\n' "$1" >> /tmp/features-test-install.log
}

log_entrypoint() {
  printf '%s\n' "$1" >> /tmp/features-test-entrypoint.log
}

log_hook() {
  printf '%s\n' "$1" >> /tmp/features-test-hooks.log
}

log_state() {
  mkdir -p "$state_root/$FEATURES_ID"
  printf '%s\n' "$1" >> "$state_root/$FEATURES_ID/hooks.log"
}
