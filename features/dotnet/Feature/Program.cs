using System.Runtime.Versioning;
using DevcontainerConfig.Dotnet.Feature;

[assembly: SupportedOSPlatform("linux")]

string hook = args.Length > 0 ? args[0] : "";
if (hook is not "install")
{
    Console.Error.WriteLine("usage: Feature <install>");
    return 2;
}

string stagedDir = Environment.GetEnvironmentVariable("FEATURES_DIR") is { Length: > 0 } dir
    ? dir
    : Directory.GetCurrentDirectory();

try
{
    await Install.RunAsync(stagedDir);
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine($"{hook}: {e.Message.ReplaceLineEndings(" ")}");
    return 1;
}
