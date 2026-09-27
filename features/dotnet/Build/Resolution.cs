using System.Text.Json;

namespace DevcontainerConfig.Dotnet.Build;

internal static class Resolution
{
    internal static async Task<Artifact> ResolveAsync(
        FileInfo config,
        string component,
        string version,
        string arch,
        CancellationToken cancellationToken
    )
    {
        string rid = $"linux-{MapArch(arch)}";
        FeatureConfig feature = await LoadAsync(config, cancellationToken);

        if (!feature.Components.TryGetValue(component, out ComponentConfig? componentConfig))
        {
            throw new BuildException(
                $"component '{component}' not found in {config.FullName}; available components: "
                    + $"{string.Join(", ", feature.Components.Keys)}."
            );
        }

        if (!componentConfig.Versions.TryGetValue(version, out ComponentVersion? componentVersion))
        {
            throw new BuildException(
                $"version '{version}' not found for component '{component}' in {config.FullName}; "
                    + $"available versions: {string.Join(", ", componentConfig.Versions.Keys)}."
            );
        }

        if (!componentVersion.Rids.TryGetValue(rid, out JsonElement ridEntry))
        {
            throw new BuildException(
                $"rid '{rid}' not found for component '{component}' version '{version}' in "
                    + $"{config.FullName}; available rids: {string.Join(", ", componentVersion.Rids.Keys)}."
            );
        }

        Artifact artifact =
            ridEntry.Deserialize<Artifact>()
            ?? throw new BuildException($"artifact for rid '{rid}' is null in {config.FullName}.");

        if (artifact.Sha512.Length != 128 || !artifact.Sha512.All(char.IsAsciiHexDigit))
        {
            throw new BuildException(
                $"sha512 for component '{component}' version '{version}' rid '{rid}' is not 128 hex " + "characters."
            );
        }

        return artifact;
    }

    static string MapArch(string arch)
    {
        return arch switch
        {
            "amd64" => "x64",
            "arm64" => "arm64",
            _ => throw new BuildException($"arch '{arch}' is not one of: amd64, arm64."),
        };
    }

    static async Task<FeatureConfig> LoadAsync(FileInfo config, CancellationToken cancellationToken)
    {
        await using FileStream stream = config.OpenRead();
        return await JsonSerializer.DeserializeAsync<FeatureConfig>(stream, cancellationToken: cancellationToken)
            ?? throw new BuildException($"{config.FullName} deserialized to null.");
    }
}
