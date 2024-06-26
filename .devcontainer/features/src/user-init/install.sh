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

XDG_CONFIG_HOME=${HOME}/.config
XDG_CACHE_HOME=${HOME}/.cache
XDG_DATA_HOME=${HOME}/.local/share
XDG_STATE_HOME=${HOME}/.local/state
mkdir --parents "${XDG_CONFIG_HOME}" "${XDG_CACHE_HOME}" "${XDG_DATA_HOME}" "${XDG_STATE_HOME}"
chown --recursive "${_REMOTE_USER}:${_REMOTE_USER}" "${HOME}"
