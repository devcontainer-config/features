using System.Runtime.Versioning;
using DevcontainerConfig.Dotnet;
using DevcontainerConfig.Dotnet.Install;
using DevcontainerConfig.Features;

[assembly: SupportedOSPlatform("linux")]

const string root = "/opt/dotnet";
string stagedDir = Environment.GetEnvironmentVariable("FEATURES_DIR") is { Length: > 0 } dir
    ? dir
    : Directory.GetCurrentDirectory();

try
{
    Options options = OptionsFile.Read(stagedDir, OptionsContext.Default.FeatureOptions);
    List<Source> sources = Scan.Sources(stagedDir);
    foreach (Source source in sources)
    {
        Merge.Into(source, root);
    }
    Registration.Register(root);
    if (options.TabCompletions)
    {
        await Completions.GenerateAsync(root, sources);
    }
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine($"install: {e.Message.ReplaceLineEndings(" ")}");
    return 1;
}
