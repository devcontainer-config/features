namespace DevcontainerConfig.Dotnet.Build;

internal static class Http
{
    internal static async Task DownloadAsync(string tempPath, string url, CancellationToken cancellationToken)
    {
        using HttpClient client = new();
        await using Stream httpStream = await client.GetStreamAsync(url, cancellationToken);
        await using FileStream fileStream = File.Create(tempPath);
        await httpStream.CopyToAsync(fileStream, cancellationToken);
    }
}
