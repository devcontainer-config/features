## Notes

Creates `remoteUser` with UID 1000.

Each user gets its own subtree under the five volume-mounted roots:

| Variable          | Directory                               |
| ----------------- | --------------------------------------- |
| `XDG_CONFIG_HOME` | `/etc/devcontainer-config/<user>`       |
| `XDG_CACHE_HOME`  | `/var/cache/devcontainer-config/<user>` |
| `XDG_DATA_HOME`   | `/usr/share/devcontainer-config/<user>` |
| `XDG_STATE_HOME`  | `/var/lib/devcontainer-config/<user>`   |
| `XDG_BIN_HOME`    | `/usr/bin/devcontainer-config/<user>`   |

`XDG_BIN_HOME` is prepended to `PATH`.
