FROM scratch AS linux-amd64-base
FROM scratch AS linux-arm64-base

ARG TARGETOS
ARG TARGETARCH
FROM ${TARGETOS}-${TARGETARCH}-base
ARG TARGETOS
ARG TARGETARCH
COPY ${TARGETOS}/${TARGETARCH}/features/ripgrep/ /features/ripgrep/
