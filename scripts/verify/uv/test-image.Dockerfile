# check=skip=InvalidDefaultArgInFrom
ARG UV_IMAGE_REF

FROM ${UV_IMAGE_REF} AS uv

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
COPY options.json /opt/devcontainer-config/features/uv/options.json
