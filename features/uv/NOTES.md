## Examples

Installing uv:

```dockerfile
FROM ghcr.io/devcontainer-config/features/uv AS uv

FROM base-image
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
```

Installing a pinned Python version:

```dockerfile
FROM ghcr.io/devcontainer-config/features/uv AS uv
FROM ghcr.io/devcontainer-config/features/uv/python:3.15 AS uv-python-3.15

FROM base-image
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
COPY --from=uv-python-3.15 /features/uv/ /opt/devcontainer-config/features/uv/
```

Installing additional Python versions:

```dockerfile
FROM ghcr.io/devcontainer-config/features/uv AS uv
FROM ghcr.io/devcontainer-config/features/uv/python:3.15 AS uv-python-3.15
FROM ghcr.io/devcontainer-config/features/uv/python:3.14 AS uv-python-3.14

FROM base-image
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
COPY --from=uv-python-3.15 /features/uv/ /opt/devcontainer-config/features/uv/
COPY --from=uv-python-3.14 /features/uv/ /opt/devcontainer-config/features/uv/
```
