# Features (features)

Install and setup image-based features.

## Example Usage

```json
"features": {
    "ghcr.io/devcontainer-config/features/features:0": {}
}
```

## Options

| Options Id   | Description                                                            | Type   | Default Value                     |
| ------------ | ---------------------------------------------------------------------- | ------ | --------------------------------- |
| featuresPath | Parent directory of image-based features (the Dockerfile COPY target). | string | /opt/devcontainer-config/features |

## Notes

Installs and setup `image-based features`: each directory under the `featuresPath` is a feature whose `install`
executable runs at devcontainer build time, and optionally with lifecycle executables (e.g., `onCreate`) to be invoked
by this features's life cycle hooks (e.g., `onCreateCommand`).

### Usage

Example:

```dockerfile
FROM scratch AS some-feature
COPY some-feature/ /some-feature/

FROM base-image
COPY --from=some-feature /some-feature/ /opt/devcontainer-config/features/some-feature
```

The `COPY` target should match `featuresPath` (defaults to `/opt/devcontainer-config/features`):

```json
"features": {
    "features": { "featuresPath": "..." }
}
```

### Feature convention

| File            | Kind       | Required | Description                           |
| --------------- | ---------- | -------- | ------------------------------------- |
| `install`       | executable | true     | Corresponds to `install.sh`           |
| `installsAfter` | text file  | false    | Corresponds to `installsAfter`        |
| `onCreate`      | executable | false    | Corresponds to `onCreateCommand`      |
| `updateContent` | executable | false    | Corresponds to `updateContentCommand` |
| `postCreate`    | executable | false    | Corresponds to `postCreateCommand`    |
| `postStart`     | executable | false    | Corresponds to `postStartCommand`     |
| `postAttach`    | executable | false    | Corresponds to `postAttachCommand`    |
| `entrypoint`    | executable | false    | Corresponds to `entrypoint`           |

### Environment

Every executable receives these environment variables:

| Variable        | Value                         |
| --------------- | ----------------------------- |
| `FEATURES_PATH` | the resolved `featuresPath`   |
| `FEATURES_ID`   | the feature's dir name        |
| `FEATURES_DIR`  | `$FEATURES_PATH/$FEATURES_ID` |

`/var/lib/devcontainer-config/features` is a mounted volume for assets that mean to survive devcontainer rebuild.

### Ordering

`<feature-name>/installsAfter` can be used to control install ordering in a way similar to `installsAfter` in `devcontainer-feature.json`, example:

```
# comment
feature1
feature2
```

---

_Note: This file was auto-generated from the [devcontainer-feature.json](https://github.com/devcontainer-config/features/blob/main/.devcontainer/features/src/features/devcontainer-feature.json). Add additional notes to a `NOTES.md`._
