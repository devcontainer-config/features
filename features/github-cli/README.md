# GitHub CLI (github-cli)

Installs the GitHub CLI (gh).

## Example Usage

```dockerfile
FROM ghcr.io/devcontainer-config/features/github-cli AS github-cli

FROM base-image
COPY --from=github-cli /features/github-cli/ /opt/devcontainer-config/features/github-cli/
```

## Installed files

| Source                      | Destination                                          |
| --------------------------- | ---------------------------------------------------- |
| `bin/gh`                    | `/usr/local/bin/gh`                                  |
| `share/man/man1/*.1`        | `/usr/local/share/man/man1/`                         |
| `LICENSE`                   | `/usr/local/share/doc/gh/LICENSE`                    |
| `gh completion -s bash`     | `/usr/local/share/bash-completion/completions/gh`    |
| `gh completion -s zsh`      | `/usr/local/share/zsh/site-functions/_gh`            |
| `gh completion -s fish`     | `/usr/local/share/fish/vendor_completions.d/gh.fish` |
| `export GH_TELEMETRY=false` | `/etc/profile.d/gh.sh`                               |

---

_Note: This file was auto-generated from the [feature.json](https://github.com/devcontainer-config/features/blob/main/features/github-cli/feature.json). Add additional notes to a `NOTES.md`._
