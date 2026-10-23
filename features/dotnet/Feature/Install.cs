using DevcontainerConfig.Features;

namespace DevcontainerConfig.Dotnet.Feature;

internal static class Install
{
    private const string Root = "/opt/dotnet";

    internal static async Task RunAsync(string stagedDir)
    {
        Options options = OptionsFile.Read(stagedDir, OptionsContext.Default.FeatureOptions);
        List<Source> sources = Scan.Sources(stagedDir);
        foreach (Source source in sources)
        {
            Merge.Into(source, Root);
        }
        Registration.Register(Root);
        if (options.TabCompletions)
        {
            await Completions.GenerateAsync(Root, sources);
        }
    }
}
