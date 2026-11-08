using System.Runtime.Versioning;
using DevcontainerConfig.CodeServer.Feature;

[assembly: SupportedOSPlatform("linux")]

string hook = args.Length > 0 ? args[0] : "";
if (hook is not ("install" or "postStart"))
{
    Console.Error.WriteLine("usage: Feature <install|postStart>");
    return 2;
}

string stagedDir = Environment.GetEnvironmentVariable("FEATURES_DIR") is { Length: > 0 } dir
    ? dir
    : Directory.GetCurrentDirectory();

try
{
    if (hook == "install")
    {
        Install.Run(stagedDir);
    }
    else
    {
        PostStart.Run(stagedDir);
    }
    return 0;
}
catch (Exception e)
{
    Console.Error.WriteLine($"{hook}: {e.Message.ReplaceLineEndings(" ")}");
    return 1;
}
