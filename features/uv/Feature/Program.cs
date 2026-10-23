using System.Runtime.Versioning;
using DevcontainerConfig.Uv.Feature;

[assembly: SupportedOSPlatform("linux")]

string hook = args.Length > 0 ? args[0] : "";
if (hook is not ("install" or "onCreate"))
{
    Console.Error.WriteLine("usage: Feature <install|onCreate>");
    return 2;
}

string stagedDir = Environment.GetEnvironmentVariable("FEATURES_DIR") is { Length: > 0 } dir
    ? dir
    : Directory.GetCurrentDirectory();

try
{
    if (hook == "install")
    {
        await Install.RunAsync(stagedDir);
    }
    else
    {
        await Create.RunAsync(stagedDir);
    }
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine($"{hook}: {e.Message.ReplaceLineEndings(" ")}");
    return 1;
}
