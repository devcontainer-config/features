using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using DevcontainerConfig.Features;

namespace DevcontainerConfig.Uv.Feature;

internal static class Downloads
{
    internal static void Merge(string stagedDir)
    {
        string entriesDir = Path.Join(stagedDir, "python", "entries");
        if (!Directory.Exists(entriesDir))
        {
            return;
        }

        JsonObject merged = [];
        foreach (
            string path in Directory.EnumerateFiles(entriesDir, "*.json").OrderBy(path => path, StringComparer.Ordinal)
        )
        {
            foreach ((string key, JsonNode? entry) in ReadObject(path))
            {
                merged[key] = entry?.DeepClone();
            }
        }

        string target = Path.Join(stagedDir, "python", "downloads.json");
        File.WriteAllText(target, merged.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        Console.WriteLine($"install: merged {merged.Count} python entries into {target}");
    }

    internal static List<DownloadEntry> Entries(string path)
    {
        try
        {
            Dictionary<string, DownloadEntry> entries =
                JsonSerializer.Deserialize(File.ReadAllText(path), DownloadsContext.Default.Entries)
                ?? throw new FeatureException($"{path} is null.");
            return
            [
                .. entries
                    .Values.OrderBy(entry => entry.Major)
                    .ThenBy(entry => entry.Minor)
                    .ThenBy(entry => entry.Patch),
            ];
        }
        catch (JsonException e)
        {
            throw new FeatureException($"{path}: {e.Message}");
        }
    }

    private static JsonObject ReadObject(string path)
    {
        try
        {
            return JsonNode.Parse(File.ReadAllText(path)) as JsonObject
                ?? throw new FeatureException($"{path} is not a JSON object.");
        }
        catch (JsonException e)
        {
            throw new FeatureException($"{path}: {e.Message}");
        }
    }
}

internal sealed class DownloadEntry
{
    [JsonPropertyName("major")]
    public required int Major { get; init; }

    [JsonPropertyName("minor")]
    public required int Minor { get; init; }

    [JsonPropertyName("patch")]
    public required int Patch { get; init; }
}

[JsonSerializable(typeof(Dictionary<string, DownloadEntry>), TypeInfoPropertyName = "Entries")]
internal sealed partial class DownloadsContext : JsonSerializerContext;
