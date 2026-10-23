# check=skip=InvalidDefaultArgInFrom
ARG UV_IMAGE_REF
ARG UV_PYTHON_IMAGE_REF

FROM ${UV_IMAGE_REF} AS uv
FROM ${UV_PYTHON_IMAGE_REF} AS python

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
COPY --from=python /features/uv/ /opt/devcontainer-config/features/uv/
COPY options.json /opt/devcontainer-config/features/uv/options.json
