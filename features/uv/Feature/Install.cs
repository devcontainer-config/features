using DevcontainerConfig.Features;

namespace DevcontainerConfig.Uv.Feature;

internal static class Install
{
    private const string BinDir = "/usr/local/bin";

    private static readonly string[] Binaries = ["uv", "uvx"];

    internal static async Task RunAsync(string stagedDir)
    {
        Options options = OptionsFile.Read(stagedDir, OptionsContext.Default.FeatureOptions);
        WriteMarker(stagedDir, options);
        InstallBinaries(stagedDir);
        await Completions.GenerateAsync(stagedDir);
        Downloads.Merge(stagedDir);
    }

    private static void WriteMarker(string stagedDir, Options options)
    {
        if (options.DefaultPythonVersion.Length == 0)
        {
            return;
        }

        string path = Path.Join(stagedDir, "default-python");
        File.WriteAllText(path, options.DefaultPythonVersion + "\n");
    }

    private static void InstallBinaries(string stagedDir)
    {
        Directory.CreateDirectory(BinDir);
        foreach (string binary in Binaries)
        {
            string target = Path.Join(BinDir, binary);
            File.Copy(Path.Join(stagedDir, "uv", binary), target, overwrite: true);
        }
    }
}
