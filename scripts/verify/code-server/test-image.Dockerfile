# check=skip=InvalidDefaultArgInFrom
ARG CODE_SERVER_IMAGE_REF

FROM ${CODE_SERVER_IMAGE_REF} AS code-server

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=code-server /features/code-server/ /opt/devcontainer-config/features/code-server/
