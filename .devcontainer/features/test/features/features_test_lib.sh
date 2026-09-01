# Shared assertions for the `features` scenarios. A scenario script sets
# scenario_name and then sources this file; the assertions run inside the
# scenario container, as the user the CLI execs tests as.

install_log=/tmp/features-test-install.log
entrypoint_log=/tmp/features-test-entrypoint.log
hooks_log=/tmp/features-test-hooks.log
state_path=/var/lib/devcontainer-config/features
features_path_file=/opt/devcontainer-config/features-path

fail() {
  echo "$scenario_name: $*" >&2
  exit 1
}

# order_of <hook> <log>: the feature ids that ran <hook>, in run order.
order_of() {
  awk -v hook="$1" '$1 == hook { print $2 }' "$2" | paste -sd ' ' -
}

# assert_order <hook> <log> <ids>: the hook ran exactly these features,
# in exactly this order.
assert_order() {
  got=$(order_of "$1" "$2")
  if [ "$got" != "$3" ]; then
    fail "$1 ran '$got', expected '$3' (log $1: $(cat "$2" 2> /dev/null))"
  fi
}

# assert_path <log> <path>: every logged line recorded that features path.
assert_path() {
  if [ -n "$(grep -v "path=$2\$" "$1" 2> /dev/null)" ]; then
    fail "log $1 contains lines outside $2: $(cat "$1" 2> /dev/null)"
  fi
}

# assert_persisted_path <path>: the dispatcher reads the features path the
# install persisted, not the option the container was launched with.
assert_persisted_path() {
  got=$(cat "$features_path_file" 2> /dev/null)
  if [ "$got" != "$1" ]; then
    fail "persisted features path is '$got', expected '$1'"
  fi
}

# assert_hooks_logged <id> <hooks>: the feature's own state directory (it
# decides to log under the state root) exists, is writable by the current user,
# and its log holds exactly <hooks>, in the order the container ran them.
assert_hooks_logged() {
  dir=$state_path/$1
  if [ ! -d "$dir" ]; then
    fail "missing state directory $dir"
  fi
  if [ ! -w "$dir" ]; then
    fail "state directory $dir is not writable by $(id --user --name)"
  fi
  got=$(paste -sd ' ' - < "$dir/hooks.log" 2> /dev/null)
  if [ "$got" != "$2" ]; then
    fail "state log for '$1' is '$got', expected '$2'"
  fi
}

# assert_init_pid1: the Feature's init option runs the container with
# docker-init as PID 1.
assert_init_pid1() {
  pid1=$(cat /proc/1/comm 2> /dev/null)
  if [ "$pid1" != "docker-init" ]; then
    fail "PID 1 is '$pid1', expected docker-init"
  fi
}

# wait_for_lines <log> <count>: the container entrypoint runs concurrently
# with the lifecycle hooks, so wait (up to 30s) until the entrypoint has
# logged <count> markers before asserting on it.
wait_for_lines() {
  i=0
  while [ "$i" -lt 150 ]; do
    if [ -f "$1" ] && [ "$(grep -c . "$1")" -ge "$2" ]; then
      return 0
    fi
    i=$((i + 1))
    sleep 0.2
  done
  return 1
}
