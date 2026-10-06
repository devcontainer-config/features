# check=skip=InvalidDefaultArgInFrom
ARG RIPGREP_IMAGE_REF

FROM ${RIPGREP_IMAGE_REF} AS ripgrep

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=ripgrep /features/ripgrep/ /opt/devcontainer-config/features/ripgrep/
