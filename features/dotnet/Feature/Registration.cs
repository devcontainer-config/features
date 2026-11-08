using DevcontainerConfig.Features;

namespace DevcontainerConfig.Dotnet.Feature;

internal static class Registration
{
    private const string LocationDir = "/etc/dotnet";
    private const string LinkPath = "/usr/local/bin/dotnet";
    private const string ProfileDir = "/etc/profile.d";

    internal static void Register(string root)
    {
        WriteInstallLocation(root);
        CreateSymlink(root);
        WriteProfileD(root);
    }

    private static void WriteInstallLocation(string root)
    {
        Directory.CreateDirectory(LocationDir);
        string path = Path.Join(LocationDir, "install_location");
        File.WriteAllText(path, $"{root}\n");
        Console.WriteLine($"install: registered {root} in {path}");
    }

    private static void CreateSymlink(string root)
    {
        string target = Path.Join(root, "dotnet");
        SymbolicLink.Replace(LinkPath, target);
        Console.WriteLine($"install: linked {LinkPath} to {target}");
    }

    private static void WriteProfileD(string root)
    {
        Directory.CreateDirectory(ProfileDir);
        string path = Path.Join(ProfileDir, "dotnet.sh");
        File.WriteAllText(
            path,
            $$"""
            export DOTNET_ROOT="{{root}}"
            export DOTNET_CLI_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/dotnet/cli"
            export NUGET_PACKAGES="${XDG_DATA_HOME:-$HOME/.local/share}/NuGet/global-packages"
            export DOTNET_CLI_TELEMETRY_OPTOUT=true
            export DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK=true
            export PATH="$PATH:$DOTNET_CLI_HOME/.dotnet/tools"
            """
        );
        Console.WriteLine($"install: wrote {path}");
    }
}
