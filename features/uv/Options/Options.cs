using System.ComponentModel;
using System.Text.Json.Serialization;

namespace DevcontainerConfig.Uv;

public sealed class Options(string defaultPythonVersion = "")
{
    [JsonPropertyName("defaultPythonVersion")]
    [Description(
        "Install the given Python version and link it as the default python and python3. A staged version installs from the image; any other version downloads when the container is created."
    )]
    public string DefaultPythonVersion { get; } = defaultPythonVersion;
}

[JsonSourceGenerationOptions(UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow)]
[JsonSerializable(typeof(Options), TypeInfoPropertyName = "FeatureOptions")]
public sealed partial class OptionsContext : JsonSerializerContext;
