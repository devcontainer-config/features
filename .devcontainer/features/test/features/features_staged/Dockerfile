FROM scratch AS alpha
COPY 10-alpha/ /10-alpha/

FROM scratch AS beta
COPY 20-beta/ /20-beta/

FROM scratch AS gamma
COPY 30-gamma/ /30-gamma/

FROM devcontainer
COPY .shared/ /opt/devcontainer-config/features/.shared
COPY --from=alpha /10-alpha/ /opt/devcontainer-config/features/10-alpha
COPY --from=beta /20-beta/ /opt/devcontainer-config/features/20-beta
COPY --from=gamma /30-gamma/ /opt/devcontainer-config/features/30-gamma
