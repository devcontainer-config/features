using System.Diagnostics;
using System.Globalization;
using DevcontainerConfig.Features;

namespace DevcontainerConfig.CodeServer.Feature;

internal static class PostStart
{
    internal static void Run(string stagedDir)
    {
        Options options = OptionsFile.Read(stagedDir, OptionsContext.Default.FeatureOptions);
        options.Validate();

        string cachePath = XdgPath("XDG_CACHE_HOME", ".cache", "code-server");
        string statePath = XdgPath("XDG_STATE_HOME", Path.Join(".local", "state"), "code-server");
        Directory.CreateDirectory(cachePath);
        Directory.CreateDirectory(statePath);
        if (options.Socket.Length > 0)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(options.Socket)!);
        }

        string logPath = Path.Join(cachePath, "code-server.log");
        string pidPath = Path.Join(statePath, "code-server.pid");
        if (IsRunning(pidPath, stagedDir))
        {
            return;
        }

        ProcessStartInfo startInfo = new(Path.Join(stagedDir, "launch")) { UseShellExecute = false };
        startInfo.ArgumentList.Add(logPath);
        startInfo.ArgumentList.Add(Path.Join(stagedDir, "code-server", "bin", "code-server"));
        foreach (string argument in ArgumentsOf(options))
        {
            startInfo.ArgumentList.Add(argument);
        }
        SetSecret(startInfo, "PASSWORD", options.PasswordFile);
        SetSecret(startInfo, "HASHED_PASSWORD", options.HashedPasswordFile);
        SetSecret(startInfo, "GITHUB_TOKEN", options.GithubAuthTokenFile);

        using Process process = new() { StartInfo = startInfo };
        try
        {
            if (!process.Start())
            {
                throw new FeatureException("code-server did not start");
            }
            File.WriteAllText(pidPath, $"{process.Id.ToString(CultureInfo.InvariantCulture)}\n");
        }
        catch
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
                // The process already exited, so there is no server left to stop.
            }
            throw;
        }
    }

    private static List<string> ArgumentsOf(Options options)
    {
        List<string> arguments = ["--auth", options.Auth];
        if (options.Socket.Length > 0)
        {
            arguments.Add("--socket");
            arguments.Add(options.Socket);
            arguments.Add("--socket-mode");
            arguments.Add(options.SocketMode);
        }
        else
        {
            arguments.Add("--bind-addr");
            arguments.Add($"{options.Host}:{options.Port.ToString(CultureInfo.InvariantCulture)}");
        }
        AddFlag(arguments, options.DisableTelemetry, "--disable-telemetry");
        AddFlag(arguments, options.DisableUpdateCheck, "--disable-update-check");
        AddFlag(arguments, options.DisableWorkspaceTrust, "--disable-workspace-trust");
        AddFlag(arguments, options.DisableFileDownloads, "--disable-file-downloads");
        AddFlag(arguments, options.DisableFileUploads, "--disable-file-uploads");
        AddFlag(arguments, options.DisableProxy, "--disable-proxy");
        AddRepeated(arguments, "--proxy-domain", options.ProxyDomain);
        if (options.AbsProxyBasePath.Length > 0)
        {
            arguments.Add("--abs-proxy-base-path");
            arguments.Add(options.AbsProxyBasePath);
        }
        AddRepeated(arguments, "--trusted-origins", options.TrustedOrigins);
        if (options.Locale.Length > 0)
        {
            arguments.Add("--locale");
            arguments.Add(options.Locale);
        }
        AddFlag(arguments, options.Verbose, "--verbose");
        arguments.Add(options.Workspace.Length > 0 ? options.Workspace : Directory.GetCurrentDirectory());
        arguments.AddRange(options.Args);
        return arguments;
    }

    private static void AddFlag(List<string> arguments, bool enabled, string flag)
    {
        if (enabled)
        {
            arguments.Add(flag);
        }
    }

    private static void AddRepeated(List<string> arguments, string flag, string[] values)
    {
        foreach (string value in values)
        {
            arguments.Add(flag);
            arguments.Add(value);
        }
    }

    private static void SetSecret(ProcessStartInfo startInfo, string name, string path)
    {
        if (path.Length == 0)
        {
            return;
        }
        string value;
        try
        {
            value = File.ReadAllText(path).TrimEnd('\r', '\n');
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            throw new FeatureException($"{name} file {path} cannot be read: {e.Message}");
        }
        if (value.Length == 0)
        {
            throw new FeatureException($"{name} file {path} is empty");
        }
        startInfo.Environment[name] = value;
    }

    private static string XdgPath(string variable, string fallback, string suffix)
    {
        string? root = Environment.GetEnvironmentVariable(variable);
        if (root is null || root.Length == 0 || !Path.IsPathRooted(root))
        {
            string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (home.Length == 0)
            {
                throw new FeatureException($"HOME is not set; cannot resolve {variable}");
            }
            root = Path.Join(home, fallback);
        }
        return Path.Join(root, suffix);
    }

    private static bool IsRunning(string pidPath, string stagedDir)
    {
        if (!File.Exists(pidPath))
        {
            return false;
        }
        string text = File.ReadAllText(pidPath).Trim();
        if (!int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out int pid) || pid <= 0)
        {
            return false;
        }
        string cmdline;
        try
        {
            cmdline = File.ReadAllText(Path.Join("/proc", pid.ToString(CultureInfo.InvariantCulture), "cmdline"));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return false;
        }
        string nodePath = Path.Join(stagedDir, "code-server", "lib", "node");
        return cmdline.Split('\0').Contains(nodePath, StringComparer.Ordinal);
    }
}
