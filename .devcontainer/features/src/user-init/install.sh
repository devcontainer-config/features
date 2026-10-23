#!/bin/sh
set -eu

# spell-checker:ignore groupmod NOPASSWD usermod

old_user=$(id --user --name 1000)
old_group=$(id --group --name "${old_user}")
new_user=${_REMOTE_USER}
home=/home/${new_user}

usermod --login "${new_user}" --home "${home}" --move-home "${old_user}"
groupmod --new-name "${new_user}" "${old_group}"

rm --force "/etc/sudoers.d/${old_user}"
printf '%s ALL=(root) NOPASSWD:ALL\n' "${new_user}" > "/etc/sudoers.d/${new_user}"
chmod ug=r,o= "/etc/sudoers.d/${new_user}"

# Ideally these folders would be in ${HOME}, but there's no way to mount volumes based on remoteUser.
# See https://github.com/devcontainers/spec/issues/220
xdg_config_home_root=/etc/devcontainer-config
xdg_cache_home_root=/var/cache/devcontainer-config
xdg_data_home_root=/usr/share/devcontainer-config
xdg_state_home_root=/var/lib/devcontainer-config
xdg_bin_home_root=/usr/bin/devcontainer-config
mkdir --parents \
  "${xdg_config_home_root}" \
  "${xdg_cache_home_root}" \
  "${xdg_data_home_root}" \
  "${xdg_state_home_root}" \
  "${xdg_bin_home_root}"
chmod --recursive a+rwx \
  "${xdg_config_home_root}" \
  "${xdg_cache_home_root}" \
  "${xdg_data_home_root}" \
  "${xdg_state_home_root}" \
  "${xdg_bin_home_root}"

cat > /etc/profile.d/00-xdg.sh << EOF
XDG_CONFIG_HOME="${xdg_config_home_root}/\$(id -un)"
XDG_CACHE_HOME="${xdg_cache_home_root}/\$(id -un)"
XDG_DATA_HOME="${xdg_data_home_root}/\$(id -un)"
XDG_STATE_HOME="${xdg_state_home_root}/\$(id -un)"
XDG_BIN_HOME="${xdg_bin_home_root}/\$(id -un)"
export XDG_CONFIG_HOME XDG_CACHE_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_BIN_HOME
mkdir -p "\$XDG_CONFIG_HOME" "\$XDG_CACHE_HOME" "\$XDG_DATA_HOME" "\$XDG_STATE_HOME" "\$XDG_BIN_HOME"
PATH="\$XDG_BIN_HOME:\$PATH"
export PATH
EOF
chmod 0644 /etc/profile.d/00-xdg.sh

chown --recursive "${new_user}:${new_user}" "${home}"
