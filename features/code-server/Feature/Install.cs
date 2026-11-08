using DevcontainerConfig.Features;

namespace DevcontainerConfig.CodeServer.Feature;

internal static class Install
{
    private const string BinDir = "/usr/local/bin";
    private const string LinkPath = "/usr/local/bin/code-server";

    internal static void Run(string stagedDir)
    {
        Options options = OptionsFile.Read(stagedDir, OptionsContext.Default.FeatureOptions);
        options.Validate();

        Directory.CreateDirectory(BinDir);
        File.Delete(LinkPath);
        File.CreateSymbolicLink(LinkPath, Path.Join(stagedDir, "code-server", "bin", "code-server"));
    }
}
