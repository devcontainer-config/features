#!/bin/sh
set -e

# spell-checker:ignore usermod NOPASSWD

OLD_USER=$(id --user --name 1000)
OLD_GROUP=$(id --group --name "${OLD_USER}")
HOME=/home/${_REMOTE_USER}
usermod --login "${_REMOTE_USER}" --home "${HOME}" --move-home "${OLD_USER}"
groupmod --new-name "${_REMOTE_USER}" "${OLD_GROUP}"

rm --force "/etc/sudoers.d/${OLD_USER}"
echo "${_REMOTE_USER} ALL=(root) NOPASSWD:ALL" > "/etc/sudoers.d/${_REMOTE_USER}"
chmod ug=r,o= "/etc/sudoers.d/${_REMOTE_USER}"

# Ideally these folders would be in ${HOME}, but there's no way to mount volumes base on remoteUser.
# See https://github.com/devcontainers/spec/issues/220
XDG_CONFIG_HOME_ROOT=/etc/devcontainer-config
XDG_CACHE_HOME_ROOT=/var/cache/devcontainer-config
XDG_DATA_HOME_ROOT=/usr/share/devcontainer-config
XDG_STATE_HOME_ROOT=/var/lib/devcontainer-config
mkdir --parents "${XDG_CONFIG_HOME_ROOT}" "${XDG_CACHE_HOME_ROOT}" "${XDG_DATA_HOME_ROOT}" "${XDG_STATE_HOME_ROOT}"
chmod -R a+rwx "${XDG_CONFIG_HOME_ROOT}" "${XDG_CACHE_HOME_ROOT}" "${XDG_DATA_HOME_ROOT}" "${XDG_STATE_HOME_ROOT}"

cat > /etc/profile.d/00-xdg.sh << EOF
XDG_CONFIG_HOME="${XDG_CONFIG_HOME_ROOT}/\$(id -un)"
XDG_CACHE_HOME="${XDG_CACHE_HOME_ROOT}/\$(id -un)"
XDG_DATA_HOME="${XDG_DATA_HOME_ROOT}/\$(id -un)"
XDG_STATE_HOME="${XDG_STATE_HOME_ROOT}/\$(id -un)"
export XDG_CONFIG_HOME XDG_CACHE_HOME XDG_DATA_HOME XDG_STATE_HOME
mkdir -p "\$XDG_CONFIG_HOME" "\$XDG_CACHE_HOME" "\$XDG_DATA_HOME" "\$XDG_STATE_HOME"
EOF
chmod 0644 /etc/profile.d/00-xdg.sh

chown --recursive "${_REMOTE_USER}:${_REMOTE_USER}" "${HOME}"
