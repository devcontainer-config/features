using System.Runtime.Versioning;
using DevcontainerConfig.Dotnet.Install;

[assembly: SupportedOSPlatform("linux")]

const string root = "/opt/dotnet";
string stagedDir = Environment.GetEnvironmentVariable("FEATURES_DIR") is { Length: > 0 } dir
    ? dir
    : Directory.GetCurrentDirectory();

try
{
    foreach (Source source in Scan.Sources(stagedDir))
    {
        Merge.Into(source, root);
    }
    Registration.Register(root);
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine($"install: {e.Message.ReplaceLineEndings(" ")}");
    return 1;
}
