using System.ComponentModel;
using System.Text.Json.Serialization;

namespace DevcontainerConfig.Dotnet;

public sealed class Options(bool tabCompletions = true)
{
    [JsonPropertyName("tabCompletions")]
    [Description("Generate shell tab completions for the dotnet CLI. Requires SDK 10 or newer.")]
    public bool TabCompletions { get; } = tabCompletions;
}

[JsonSourceGenerationOptions(UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow)]
[JsonSerializable(typeof(Options), TypeInfoPropertyName = "FeatureOptions")]
public sealed partial class OptionsContext : JsonSerializerContext;
