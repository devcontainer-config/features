using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevcontainerConfig.Dotnet.Build;

sealed class Artifact
{
    [JsonPropertyName("url")]
    public required string Url { get; init; }

    [JsonPropertyName("sha512")]
    public required string Sha512 { get; init; }
}

sealed class ComponentVersion
{
    [JsonExtensionData]
    public Dictionary<string, JsonElement> Rids { get; init; } = [];
}

sealed class ComponentConfig
{
    [JsonPropertyName("versions")]
    public required Dictionary<string, ComponentVersion> Versions { get; init; }
}

sealed class FeatureConfig
{
    [JsonPropertyName("components")]
    public required Dictionary<string, ComponentConfig> Components { get; init; }
}

sealed record PayloadSection(string Source, string Component, string Key, ComponentVersion Entry);

internal static class Config
{
    internal static FeatureConfig Parse(string json, string source)
    {
        return JsonSerializer.Deserialize<FeatureConfig>(json)
            ?? throw new BuildException($"{source} deserialized to null.");
    }

    internal static PayloadSection Section(FeatureConfig config, string source, string component, string key)
    {
        if (!config.Components.TryGetValue(component, out ComponentConfig? componentConfig))
        {
            throw new BuildException(
                $"component '{component}' not found in {source}; available components: "
                    + $"{string.Join(", ", config.Components.Keys)}."
            );
        }

        if (!componentConfig.Versions.TryGetValue(key, out ComponentVersion? entry))
        {
            throw new BuildException(
                $"version '{key}' not found for component '{component}' in {source}; "
                    + $"available versions: {string.Join(", ", componentConfig.Versions.Keys)}."
            );
        }

        return new PayloadSection(source, component, key, entry);
    }
}
