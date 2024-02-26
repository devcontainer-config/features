# Devcontainer Features for Devcontainer Configurations

[AppVeyor Badge]: https://img.shields.io/appveyor/build/gdlol/devcontainer-config-features/main
[AppVeyor URL]: https://ci.appveyor.com/project/gdlol/devcontainer-config-features/branch/main

[![AppVeyor Badge][AppVeyor Badge]][AppVeyor URL]

A set of devcontainer features for better developer experience setting up devcontainers.

## [user-init](.devcontainer/features/src/user-init/README.md)

Most base images for devcontainers comes with a non-root user with UID 1000. This feature renames that user to `remoteUser` in `devcontainer.json` and sets up XDG base directories.

A non-root user can be created via the `ghcr.io/devcontainers/features/common-utils` feature, but it cannot override an existing user with UID 1000. A UID 1000 user in devcontainer is necessary for sensible file permission behavior in the host.

According to Docker behavior, directories mounted as named volumes are owned by root, unless created up-front with the correct ownership. This feature creates default XDG base directories for `remoteUser` so that they have the correct ownership when mounted as named volumes.

Use cases:

- A more neutral user name other than `vscode` or `node`.
- Mount XDG base directories to named volumes so that they are persisted across devcontainer rebuilds.

Example usage:

- [devcontainer.json](.devcontainer/devcontainer.json)

- [.env](.devcontainer/.env)

- [docker-compose.yml](.devcontainer/docker-compose.yml)

## [dot-config](.devcontainer/features/src/dot-config/README.md)

Most tools, CI providers, and even Devcontainer itself expects configuration files to be located in the project root. This feature works around this limitation by performing two-way file synchronization between files under `.config/` and the parent directory of the project root (inside the devcontainer), which should be `/workspaces` by default.

The feature takes a configuration file `.devcontainer/dot-config.json`, and maps `.config/${key}/file` to specified absolute path, or path relative the parent directory of the project root.

[Example](.devcontainer/dot-config.json)

Use cases:

- Avoid cluttering the Git project root with configuration files.
- The parent directory of the project root can be mounted as a named volume, providing persistence across rebuild and better IO performance for some artifacts like `build/`, `node_modules/`, etc.

Notes:

- The choice of the `.config/` directory comes from the default value `${HOME}/.config` of `XDG_CONFIG_HOME`.
- In the view of affected tools, the project root becomes the parent directory of the Git project root, some adjustments in usage may be required.
