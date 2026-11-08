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
