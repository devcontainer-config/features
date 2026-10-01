using System.Diagnostics;

namespace DevcontainerConfig.Dotnet.Install;

internal static class Completions
{
    private const int MinimumSdkMajor = 10;

    private static readonly (string Shell, string Path)[] Targets =
    [
        ("bash", "/usr/share/bash-completion/completions/dotnet"),
        ("zsh", "/usr/local/share/zsh/site-functions/_dotnet"),
        ("fish", "/usr/share/fish/vendor_completions.d/dotnet.fish"),
    ];

    internal static async Task GenerateAsync(string root, IEnumerable<Source> sources)
    {
        if (!sources.Any(source => source.Component == "sdk" && source.Version.Major >= MinimumSdkMajor))
        {
            return;
        }

        string temp = Directory.CreateTempSubdirectory("dotnet-completions-").FullName;
        try
        {
            foreach ((string shell, string path) in Targets)
            {
                string script = await RunAsync(root, temp, shell);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path, script);
                File.SetUnixFileMode(path, Permissions.Mode0644);
                Console.WriteLine($"install: wrote {path}");
            }
        }
        finally
        {
            Directory.Delete(temp, recursive: true);
        }
    }

    private static async Task<string> RunAsync(string root, string temp, string shell)
    {
        string home = Path.Join(temp, "home");
        Directory.CreateDirectory(home);
        ProcessStartInfo startInfo = new(Path.Join(root, "dotnet"))
        {
            WorkingDirectory = temp,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        startInfo.ArgumentList.Add("completions");
        startInfo.ArgumentList.Add("script");
        startInfo.ArgumentList.Add(shell);
        startInfo.Environment["HOME"] = home;
        startInfo.Environment["TMPDIR"] = temp;
        startInfo.Environment["DOTNET_ROOT"] = root;
        startInfo.Environment["DOTNET_CLI_HOME"] = Path.Join(temp, "cli");
        startInfo.Environment["XDG_CONFIG_HOME"] = Path.Join(temp, "config");
        startInfo.Environment["XDG_DATA_HOME"] = Path.Join(temp, "data");
        startInfo.Environment["XDG_CACHE_HOME"] = Path.Join(temp, "cache");
        startInfo.Environment["XDG_STATE_HOME"] = Path.Join(temp, "state");
        startInfo.Environment["DOTNET_NOLOGO"] = "1";
        startInfo.Environment["DOTNET_GENERATE_ASPNET_CERTIFICATE"] = "false";
        startInfo.Environment["DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK"] = "1";
        startInfo.Environment["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1";

        using Process process =
            Process.Start(startInfo) ?? throw new InstallException($"cannot run {startInfo.FileName}.");
        Task<string> output = process.StandardOutput.ReadToEndAsync();
        Task<string> error = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        string script = await output;
        string detail = (await error).Trim();
        if (process.ExitCode != 0)
        {
            throw new InstallException(
                $"dotnet completions script {shell} exited with code {process.ExitCode}"
                    + (detail.Length == 0 ? "." : $": {detail}")
            );
        }
        return script;
    }
}
