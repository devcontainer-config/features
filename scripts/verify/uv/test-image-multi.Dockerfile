# check=skip=InvalidDefaultArgInFrom
ARG UV_IMAGE_REF
ARG UV_PYTHON_LATEST_IMAGE_REF
ARG UV_PYTHON_PREVIOUS_IMAGE_REF

FROM ${UV_IMAGE_REF} AS uv
FROM ${UV_PYTHON_LATEST_IMAGE_REF} AS latest
FROM ${UV_PYTHON_PREVIOUS_IMAGE_REF} AS previous

FROM mcr.microsoft.com/devcontainers/base:debian
COPY --from=uv /features/uv/ /opt/devcontainer-config/features/uv/
COPY --from=latest /features/uv/ /opt/devcontainer-config/features/uv/
COPY --from=previous /features/uv/ /opt/devcontainer-config/features/uv/
