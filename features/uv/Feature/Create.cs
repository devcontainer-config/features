using System.Diagnostics;
using DevcontainerConfig.Features;

namespace DevcontainerConfig.Uv.Feature;

internal static class Create
{
    private const string Uv = "/usr/local/bin/uv";

    internal static async Task RunAsync(string stagedDir)
    {
        string downloads = Path.Join(stagedDir, "python", "downloads.json");
        if (File.Exists(downloads))
        {
            foreach (DownloadEntry entry in Downloads.Entries(downloads))
            {
                await RunUvAsync(
                    ["python", "install", $"{entry.Major}.{entry.Minor}.{entry.Patch}"],
                    new Dictionary<string, string>
                    {
                        ["UV_PYTHON_INSTALL_MIRROR"] = $"file://{Path.Join(stagedDir, "python")}",
                        ["UV_PYTHON_DOWNLOADS_JSON_URL"] = downloads,
                    }
                );
            }
        }

        string marker = Path.Join(stagedDir, "default-python");
        if (File.Exists(marker))
        {
            await RunUvAsync(
                ["python", "install", File.ReadAllText(marker).Trim(), "--default"],
                new Dictionary<string, string> { ["UV_PREVIEW_FEATURES"] = "python-install-default" }
            );
        }
    }

    private static async Task RunUvAsync(string[] arguments, Dictionary<string, string> environment)
    {
        ProcessStartInfo startInfo = new(Uv);
        foreach (string argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }
        foreach ((string name, string value) in environment)
        {
            startInfo.Environment[name] = value;
        }

        using Process process = Process.Start(startInfo) ?? throw new FeatureException($"cannot run {Uv}.");
        await process.WaitForExitAsync();
        if (process.ExitCode != 0)
        {
            throw new FeatureException($"{Uv} {string.Join(" ", arguments)} exited with code {process.ExitCode}.");
        }
    }
}
