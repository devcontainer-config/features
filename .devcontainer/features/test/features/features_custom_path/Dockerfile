FROM scratch AS alpha
COPY 10-alpha/ /10-alpha/

FROM scratch AS beta
COPY 20-beta/ /20-beta/

FROM devcontainer
COPY .shared/ /opt/custom-features/.shared
COPY --from=alpha /10-alpha/ /opt/custom-features/10-alpha
COPY --from=beta /20-beta/ /opt/custom-features/20-beta
