using NuGet.Versioning;

namespace DevcontainerConfig.Dotnet.Install;

internal static class Merge
{
    internal static void Into(Source source, string root)
    {
        Directory.CreateDirectory(root);
        MergeDir(source.Path, root, depth: 1);
        Console.WriteLine($"install: merged {source.Component} {source.Name} into {root}");
    }

    // Entries of the source root are depth 1: the unversioned root files, which are first-wins so they come from
    // the first processed source. Deeper files overwrite; a version-named directory at any depth is skip-if-present,
    // whole subtree.
    private static void MergeDir(string sourceDir, string targetDir, int depth)
    {
        foreach (string sourcePath in Directory.EnumerateFileSystemEntries(sourceDir))
        {
            string name = Path.GetFileName(sourcePath);
            string targetPath = Path.Join(targetDir, name);

            if (Directory.Exists(sourcePath))
            {
                if (NuGetVersion.TryParse(name, out _) && Directory.Exists(targetPath))
                {
                    continue;
                }
                Directory.CreateDirectory(targetPath);
                MergeDir(sourcePath, targetPath, depth + 1);
            }
            else if (depth == 1)
            {
                if (!File.Exists(targetPath))
                {
                    File.Copy(sourcePath, targetPath, overwrite: false);
                }
            }
            else
            {
                File.Copy(sourcePath, targetPath, overwrite: true);
            }
        }
    }
}
