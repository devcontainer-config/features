using System.Text.Json;

namespace DevcontainerConfig.Dotnet.Build;

internal static class Resolution
{
    internal static Artifact Resolve(PayloadSection section, string arch)
    {
        string rid = $"linux-{MapArch(arch)}";
        if (!section.Entry.Rids.TryGetValue(rid, out JsonElement ridEntry))
        {
            throw new BuildException(
                $"rid '{rid}' not found for component '{section.Component}' version '{section.Key}' in "
                    + $"{section.Source}; available rids: {string.Join(", ", section.Entry.Rids.Keys)}."
            );
        }

        Artifact artifact =
            ridEntry.Deserialize<Artifact>()
            ?? throw new BuildException($"artifact for rid '{rid}' is null in {section.Source}.");

        if (artifact.Sha512.Length != 128 || !artifact.Sha512.All(char.IsAsciiHexDigit))
        {
            throw new BuildException(
                $"sha512 for component '{section.Component}' version '{section.Key}' rid '{rid}' is not 128 hex "
                    + "characters."
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
}
