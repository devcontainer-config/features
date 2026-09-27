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
    [JsonPropertyName("aliases")]
    public List<string> Aliases { get; init; } = [];

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
