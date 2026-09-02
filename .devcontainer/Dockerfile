FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

RUN npm install --global pnpm@latest-11

RUN mkdir --parents /usr/share/dotnet /usr/share/devcontainer-config/NuGet/global-packages \
  && chmod --recursive a+rwX /usr/share/dotnet /usr/share/devcontainer-config
