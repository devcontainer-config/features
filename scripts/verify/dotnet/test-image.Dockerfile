# check=skip=InvalidDefaultArgInFrom
ARG DOTNET_IMAGE_REF

FROM ${DOTNET_IMAGE_REF} AS dotnet

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=dotnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
