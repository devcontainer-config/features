using DevcontainerConfig.Features;

namespace DevcontainerConfig.CodeServer.Feature;

internal static class Install
{
    private const string BinDir = "/usr/local/bin";

    internal static void Run(string stagedDir)
    {
        Options options = OptionsFile.Read(stagedDir, OptionsContext.Default.FeatureOptions);
        options.Validate();

        Directory.CreateDirectory(BinDir);
        SymbolicLink.Replace(
            Path.Join(BinDir, "code-server"),
            Path.Join(stagedDir, "code-server", "bin", "code-server")
        );
    }
}
