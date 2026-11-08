## Staging

The consumer copies the feature directory as shown in Example Usage. The `features` dispatcher runs `install` at image build time and `postStart` when the container starts. `postStart` runs as the container user and starts the server through `launch`, which detaches the server's stdio and appends its output to the log, so the lifecycle hook returns.

## Options file

Options are read from `options.json` in the feature directory:

```json
{
  "auth": "password",
  "passwordFile": "/run/secrets/code-server-password",
  "host": "127.0.0.1",
  "port": 8080
}
```

`passwordFile`, `hashedPasswordFile` and `githubAuthTokenFile` are read at `postStart` into `PASSWORD`, `HASHED_PASSWORD` and `GITHUB_TOKEN`. Trailing newlines are removed. `HASHED_PASSWORD` takes precedence over `PASSWORD`.

`workspace` is the positional workspace path. An empty value uses the hook's current directory, the workspace folder.

## Authentication

`auth` defaults to `none`, which gives anything that can reach the listen address the remote user's access. `host` defaults to `127.0.0.1`, so the server accepts connections from inside the container only. A consumer that publishes the port sets `host` to `0.0.0.0` and uses `auth: password` or terminates access at a reverse proxy.

## Address

With `socket` set, the server listens on that absolute Unix socket with `socketMode` as its file mode. `host` and `port` are ignored. Without `socket`, the server listens on `host:port`.

## Paths

- Log: `${XDG_CACHE_HOME:-$HOME/.cache}/code-server/code-server.log`
- PID: `${XDG_STATE_HOME:-$HOME/.local/state}/code-server/code-server.pid`

An unset, empty or relative XDG value uses the `$HOME` path.

## Arguments

`args` is an array of code-server arguments appended after the option-derived arguments:

```json
{ "args": ["--verbose", "--bind-addr", "0.0.0.0:9000"] }
```

One element is one argument. A later scalar flag wins in code-server, so `args` can override an option. `--` ends option parsing.

## Requirements

Linux with glibc 2.28 or newer and libstdc++ GLIBCXX_3.4.21, on amd64 or arm64. The feature installs no packages and adds no dependencies.

## Restart

A plain `docker restart` does not run `postStart`. Use `devcontainer up` or start `/usr/local/bin/code-server` manually.
