# Ripgrep (ripgrep)

Installs the ripgrep line-oriented search tool.

## Example Usage

```dockerfile
FROM ghcr.io/devcontainer-config/features/ripgrep AS ripgrep

FROM base-image
COPY --from=ripgrep /features/ripgrep/ /opt/devcontainer-config/features/ripgrep/
```

## Installed files

| Source                                | Destination                                          | Mode |
| ------------------------------------- | ---------------------------------------------------- | ---- |
| `rg`                                  | `/usr/local/bin/rg`                                  | 0755 |
| `doc/rg.1`                            | `/usr/local/share/man/man1/rg.1`                     | 0644 |
| `complete/rg.bash`                    | `/usr/local/share/bash-completion/completions/rg`    | 0644 |
| `complete/_rg`                        | `/usr/local/share/zsh/site-functions/_rg`            | 0644 |
| `complete/rg.fish`                    | `/usr/local/share/fish/vendor_completions.d/rg.fish` | 0644 |
| `COPYING`, `LICENSE-MIT`, `UNLICENSE` | `/usr/local/share/doc/ripgrep/`                      | 0644 |

---

_Note: This file was auto-generated from the [feature.json](https://github.com/devcontainer-config/features/blob/main/features/ripgrep/feature.json). Add additional notes to a `NOTES.md`._
