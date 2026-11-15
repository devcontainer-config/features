# check=skip=InvalidDefaultArgInFrom
ARG GITHUB_CLI_IMAGE_REF

FROM ${GITHUB_CLI_IMAGE_REF} AS github-cli

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=github-cli /features/github-cli/ /opt/devcontainer-config/features/github-cli/
