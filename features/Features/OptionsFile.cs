using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace DevcontainerConfig.Features;

public static class OptionsFile
{
    private const string FileName = "options.json";

    public static T Read<T>(string stagedDir, JsonTypeInfo<T> typeInfo)
    {
        string path = Path.Join(stagedDir, FileName);
        string json = File.Exists(path) ? File.ReadAllText(path) : "{}";
        try
        {
            return JsonSerializer.Deserialize(json, typeInfo) ?? throw new FeatureException($"{path} is null.");
        }
        catch (JsonException e)
        {
            throw new FeatureException($"{path}: {e.Message}");
        }
    }
}
