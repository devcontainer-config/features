namespace DevcontainerConfig.Dotnet.Install;

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
        File.SetUnixFileMode(path, Permissions.Mode0644);
        Console.WriteLine($"install: registered {root} in {path}");
    }

    private static void CreateSymlink(string root)
    {
        string target = Path.Join(root, "dotnet");
        if (Directory.Exists(LinkPath))
        {
            throw new InstallException($"{LinkPath} is a directory.");
        }

        // rename(2) replaces whatever else the path holds (absent, symlink or regular file) and never resolves the
        // destination, so the link lands in one step.
        string temp = Path.Join(Path.GetDirectoryName(LinkPath), $".dotnet-{Guid.NewGuid():N}");
        File.CreateSymbolicLink(temp, target);
        try
        {
            File.Move(temp, LinkPath, overwrite: true);
        }
        finally
        {
            File.Delete(temp);
        }
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
        File.SetUnixFileMode(path, Permissions.Mode0644);
        Console.WriteLine($"install: wrote {path}");
    }
}
