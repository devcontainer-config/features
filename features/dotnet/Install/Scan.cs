using NuGet.Versioning;

namespace DevcontainerConfig.Dotnet.Install;

sealed record Source(string Component, string Name, NuGetVersion Version, string Path);

internal static class Scan
{
    private static readonly string[] Components = ["sdk", "runtime", "aspnet"];

    internal static List<Source> Sources(string stagedDir)
    {
        if (!Directory.Exists(stagedDir))
        {
            throw new InstallException($"{stagedDir} is not a directory.");
        }

        Dictionary<string, List<string>> versionDirs = [];
        foreach (string component in Components)
        {
            string componentDir = Path.Join(stagedDir, component);
            if (!Directory.Exists(componentDir))
            {
                continue;
            }

            List<string> dirs = [.. Directory.EnumerateDirectories(componentDir)];
            if (dirs.Count == 0)
            {
                throw new InstallException($"{componentDir} has no version directory.");
            }
            versionDirs.Add(component, dirs);
        }

        if (versionDirs.Count == 0)
        {
            throw new InstallException($"{stagedDir} has no component directory.");
        }

        List<Source> sources = [];
        foreach (string component in Components)
        {
            if (!versionDirs.TryGetValue(component, out List<string>? dirs))
            {
                continue;
            }

            foreach (string dir in dirs)
            {
                string name = Path.GetFileName(dir);
                if (!NuGetVersion.TryParse(name, out NuGetVersion? version))
                {
                    throw new InstallException($"{dir} is not a version.");
                }

                string muxer = Path.Join(dir, "dotnet");
                if (!File.Exists(muxer))
                {
                    throw new InstallException($"{muxer} is missing.");
                }

                sources.Add(new Source(component, name, version, dir));
            }
        }

        return
        [
            .. sources
                .OrderBy(source => Array.IndexOf(Components, source.Component))
                .ThenByDescending(source => source.Version, VersionComparer.Default)
                .ThenBy(source => source.Name, StringComparer.Ordinal),
        ];
    }
}
