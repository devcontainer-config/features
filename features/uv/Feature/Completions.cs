using System.Diagnostics;
using DevcontainerConfig.Features;

namespace DevcontainerConfig.Uv.Feature;

internal static class Completions
{
    private static readonly (string Binary, string Command, string Shell, string Path)[] Targets =
    [
        ("uv", "generate-shell-completion", "bash", "/usr/local/share/bash-completion/completions/uv"),
        ("uv", "generate-shell-completion", "zsh", "/usr/local/share/zsh/site-functions/_uv"),
        ("uv", "generate-shell-completion", "fish", "/usr/local/share/fish/vendor_completions.d/uv.fish"),
        ("uvx", "--generate-shell-completion", "bash", "/usr/local/share/bash-completion/completions/uvx"),
        ("uvx", "--generate-shell-completion", "zsh", "/usr/local/share/zsh/site-functions/_uvx"),
        ("uvx", "--generate-shell-completion", "fish", "/usr/local/share/fish/vendor_completions.d/uvx.fish"),
    ];

    internal static async Task GenerateAsync(string stagedDir)
    {
        string temp = Directory.CreateTempSubdirectory("uv-completions-").FullName;
        try
        {
            foreach ((string binary, string command, string shell, string path) in Targets)
            {
                string script = await RunAsync(stagedDir, temp, binary, command, shell);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path, script);
                Console.WriteLine($"install: wrote {path}");
            }
        }
        finally
        {
            Directory.Delete(temp, recursive: true);
        }
    }

    private static async Task<string> RunAsync(
        string stagedDir,
        string temp,
        string binary,
        string command,
        string shell
    )
    {
        string home = Path.Join(temp, "home");
        Directory.CreateDirectory(home);
        ProcessStartInfo startInfo = new(Path.Join(stagedDir, "uv", binary))
        {
            WorkingDirectory = temp,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        startInfo.ArgumentList.Add(command);
        startInfo.ArgumentList.Add(shell);
        startInfo.Environment["HOME"] = home;
        startInfo.Environment["TMPDIR"] = temp;
        startInfo.Environment["XDG_CONFIG_HOME"] = Path.Join(temp, "config");
        startInfo.Environment["XDG_DATA_HOME"] = Path.Join(temp, "data");
        startInfo.Environment["XDG_CACHE_HOME"] = Path.Join(temp, "cache");
        startInfo.Environment["XDG_STATE_HOME"] = Path.Join(temp, "state");

        using Process process =
            Process.Start(startInfo) ?? throw new FeatureException($"cannot run {startInfo.FileName}.");
        Task<string> output = process.StandardOutput.ReadToEndAsync();
        Task<string> error = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        string script = await output;
        string detail = (await error).Trim();
        if (process.ExitCode != 0)
        {
            throw new FeatureException(
                $"{binary} {command} {shell} exited with code {process.ExitCode}"
                    + (detail.Length == 0 ? "." : $": {detail}")
            );
        }
        return script;
    }
}
