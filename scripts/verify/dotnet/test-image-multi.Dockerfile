# check=skip=InvalidDefaultArgInFrom
ARG DOTNET_SDK_IMAGE_REF
ARG DOTNET_RUNTIME_IMAGE_REF
ARG DOTNET_ASPNET_IMAGE_REF

FROM ${DOTNET_SDK_IMAGE_REF} AS sdk
FROM ${DOTNET_RUNTIME_IMAGE_REF} AS runtime
FROM ${DOTNET_ASPNET_IMAGE_REF} AS aspnet

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=sdk /features/dotnet/ /opt/devcontainer-config/features/dotnet/
COPY --from=runtime /features/dotnet/ /opt/devcontainer-config/features/dotnet/
COPY --from=aspnet /features/dotnet/ /opt/devcontainer-config/features/dotnet/
