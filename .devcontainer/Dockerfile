FROM ghcr.io/devcontainer-config/features/dotnet/sdk:10 as dotnet

FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    clang \
    zlib1g-dev \
    lld \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global pnpm@latest-11

RUN mkdir --parents /usr/share/dotnet /usr/share/devcontainer-config/NuGet/global-packages \
  && chmod --recursive a+rwX /usr/share/dotnet /usr/share/devcontainer-config

COPY --from=dotnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
