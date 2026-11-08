# code-server

Installs the code-server standalone release and starts the server from postStart.

## Example Usage

```dockerfile
FROM ghcr.io/devcontainer-config/features/code-server AS code-server

FROM base-image
COPY --from=code-server /features/code-server/ /opt/devcontainer-config/features/code-server/
```

## Options

| Options Id            | Description                                                                                                                            | Type    | Default Value |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| auth                  | The authentication type, none or password. The default none gives anything that can reach the listen address the remote user's access. | string  | none          |
| host                  | The address in --bind-addr when socket is empty. The default keeps the server on loopback.                                             | string  | 127.0.0.1     |
| port                  | The port in --bind-addr when socket is empty.                                                                                          | integer | 8080          |
| socket                | An absolute Unix socket path. When set, the socket is used instead of host and port.                                                   | string  |               |
| socketMode            | The file mode of the Unix socket, as octal digits. Used only when socket is set.                                                       | string  | 0600          |
| workspace             | The positional workspace path. An empty value uses the hook's current directory.                                                       | string  |               |
| passwordFile          | A file read at postStart into PASSWORD. Trailing newlines are removed.                                                                 | string  |               |
| hashedPasswordFile    | A file read at postStart into HASHED_PASSWORD. Takes precedence over passwordFile.                                                     | string  |               |
| githubAuthTokenFile   | A file read at postStart into GITHUB_TOKEN.                                                                                            | string  |               |
| disableTelemetry      | Pass --disable-telemetry.                                                                                                              | boolean | true          |
| disableUpdateCheck    | Pass --disable-update-check.                                                                                                           | boolean | true          |
| disableWorkspaceTrust | Pass --disable-workspace-trust.                                                                                                        | boolean | true          |
| disableFileDownloads  | Pass --disable-file-downloads.                                                                                                         | boolean | false         |
| disableFileUploads    | Pass --disable-file-uploads.                                                                                                           | boolean | false         |
| proxyDomain           | One --proxy-domain argument per element.                                                                                               | array   | []            |
| absProxyBasePath      | Pass --abs-proxy-base-path.                                                                                                            | string  |               |
| trustedOrigins        | One --trusted-origins argument per element.                                                                                            | array   | []            |
| disableProxy          | Pass --disable-proxy.                                                                                                                  | boolean | false         |
| locale                | Pass --locale.                                                                                                                         | string  |               |
| verbose               | Pass --verbose.                                                                                                                        | boolean | false         |
| args                  | One code-server argument per element, appended after the option-derived arguments.                                                     | array   | []            |

## Example Options

```json
{
  "auth": "password",
  "hashedPasswordFile": "/run/secrets/code-server-password",
  "host": "127.0.0.1",
  "port": 8080
}
```

## Address

With `socket` set, the server listens on that absolute Unix socket with `socketMode` as its file mode. `host` and `port` are ignored. Without `socket`, the server listens on `host:port`.

## Paths

- Log: `${XDG_CACHE_HOME:-$HOME/.cache}/code-server/code-server.log`
- PID: `${XDG_STATE_HOME:-$HOME/.local/state}/code-server/code-server.pid`

---

_Note: This file was auto-generated from the [feature.json](https://github.com/devcontainer-config/features/blob/main/features/code-server/feature.json). Add additional notes to a `NOTES.md`._
