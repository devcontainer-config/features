## Notes

Creates `remoteUser` with UID 1000.

Each user gets its own subtree under the four volume-mounted XDG roots:

| Variable          | Directory                               |
| ----------------- | --------------------------------------- |
| `XDG_CONFIG_HOME` | `/etc/devcontainer-config/<user>`       |
| `XDG_CACHE_HOME`  | `/var/cache/devcontainer-config/<user>` |
| `XDG_DATA_HOME`   | `/usr/share/devcontainer-config/<user>` |
| `XDG_STATE_HOME`  | `/var/lib/devcontainer-config/<user>`   |
