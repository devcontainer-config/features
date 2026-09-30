# Dotnet (dotnet)

Installs .NET SDK and/or the shared runtimes.

## Example Usage

```dockerfile
FROM ghcr.io/devcontainer-config/features/dotnet/sdk AS dotnet

FROM base-image
COPY --from=dotnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
```

## Options

| Options Id     | Description                                                                  | Type    | Default Value |
| -------------- | ---------------------------------------------------------------------------- | ------- | ------------- |
| tabCompletions | Generate shell tab completions for the dotnet CLI. Requires SDK 10 or newer. | boolean | true          |

## Examples

Installing latest stable .NET SDK:

```dockerfile
FROM ghcr.io/devcontainer-config/features/dotnet/sdk AS dotnet

FROM base-image
COPY --from=dotnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
```

Installing additional versions:

```dockerfile
FROM ghcr.io/devcontainer-config/features/dotnet/sdk AS dotnet
FROM ghcr.io/devcontainer-config/features/dotnet/sdk:lts AS dotnet-lts

FROM base-image
COPY --from=dotnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
COPY --from=dotnet-lts /features/dotnet/ /opt/devcontainer-config/features/dotnet/
```

Installing additional runtimes:

```dockerfile
FROM ghcr.io/devcontainer-config/features/dotnet/sdk AS dotnet
FROM ghcr.io/devcontainer-config/features/dotnet/runtime:lts AS dotnet-runtime-lts
FROM ghcr.io/devcontainer-config/features/dotnet/aspnet:lts AS dotnet-aspnet-lts

FROM base-image
COPY --from=dotnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
COPY --from=dotnet-runtime-lts /features/dotnet/ /opt/devcontainer-config/features/dotnet/
COPY --from=dotnet-aspnet-lts /features/dotnet/ /opt/devcontainer-config/features/dotnet/
```

---

_Note: This file was auto-generated from the [feature.json](https://github.com/devcontainer-config/features/blob/main/features/dotnet/feature.json). Add additional notes to a `NOTES.md`._
