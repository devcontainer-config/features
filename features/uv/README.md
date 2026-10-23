# Uv (uv)

Installs the uv Python package manager and pinned Python versions.

## Example Usage

```dockerfile
FROM ghcr.io/devcontainer-config/features/uv AS uv

FROM base-image
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
```

## Options

| Options Id           | Description                                                                                                                                                                          | Type   | Default Value |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------- |
| defaultPythonVersion | Install the given Python version and link it as the default python and python3. A staged version installs from the image; any other version downloads when the container is created. | string |               |

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

---

_Note: This file was auto-generated from the [feature.json](https://github.com/devcontainer-config/features/blob/main/features/uv/feature.json). Add additional notes to a `NOTES.md`._
