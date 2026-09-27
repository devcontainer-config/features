namespace DevcontainerConfig.Dotnet.Build;

internal static class Layout
{
    internal static void Assert(string outPath, string component, string version)
    {
        AssertMuxer(Path.Join(outPath, "dotnet"));

        string fxrPath = Path.Join(outPath, "host", "fxr");
        if (!Directory.Exists(fxrPath))
        {
            throw new BuildException($"{fxrPath} is missing.");
        }

        if (!Directory.EnumerateDirectories(fxrPath).Any())
        {
            throw new BuildException($"{fxrPath} has no child directory.");
        }

        string payloadPath = component switch
        {
            "sdk" => Path.Join(outPath, "sdk", version),
            "runtime" => Path.Join(outPath, "shared", "Microsoft.NETCore.App", version),
            "aspnet" => Path.Join(outPath, "shared", "Microsoft.AspNetCore.App", version),
            _ => throw new BuildException($"unknown component '{component}'."),
        };

        if (!Directory.Exists(payloadPath))
        {
            throw new BuildException($"{payloadPath} is missing.");
        }
    }

    static void AssertMuxer(string muxerPath)
    {
        FileAttributes attributes;
        try
        {
            attributes = File.GetAttributes(muxerPath);
        }
        catch (FileNotFoundException)
        {
            throw new BuildException($"{muxerPath} is missing.");
        }

        if (attributes.HasFlag(FileAttributes.Directory))
        {
            throw new BuildException($"{muxerPath} is not a regular file.");
        }

        UnixFileMode mode = File.GetUnixFileMode(muxerPath);

        if (
            !mode.HasFlag(UnixFileMode.UserExecute)
            && !mode.HasFlag(UnixFileMode.GroupExecute)
            && !mode.HasFlag(UnixFileMode.OtherExecute)
        )
        {
            throw new BuildException($"{muxerPath} has no execute permission.");
        }
    }
}
