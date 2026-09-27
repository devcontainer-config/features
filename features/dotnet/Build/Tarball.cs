using System.Formats.Tar;
using System.IO.Compression;

namespace DevcontainerConfig.Dotnet.Build;

internal static class Tarball
{
    internal static async Task ExtractAsync(string tempPath, DirectoryInfo outDir, CancellationToken cancellationToken)
    {
        outDir.Create();

        await using FileStream fileStream = File.OpenRead(tempPath);
        await using GZipStream gzip = new(fileStream, CompressionMode.Decompress);
        await TarFile.ExtractToDirectoryAsync(gzip, outDir.FullName, overwriteFiles: false, cancellationToken);
    }
}
