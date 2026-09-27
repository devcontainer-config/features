namespace DevcontainerConfig.Dotnet.Build;

internal static class Staging
{
    internal static async Task RunAsync(
        FileInfo config,
        string component,
        string version,
        string arch,
        DirectoryInfo outDir,
        CancellationToken cancellationToken
    )
    {
        Artifact artifact = await Resolution.ResolveAsync(config, component, version, arch, cancellationToken);
        string tempPath = Path.Join(Path.GetTempPath(), $"dotnet-build-{Guid.NewGuid():N}");
        try
        {
            await Http.DownloadAsync(tempPath, artifact.Url, cancellationToken);
            await Checksum.VerifyAsync(tempPath, artifact.Sha512, cancellationToken);
            await Tarball.ExtractAsync(tempPath, outDir, cancellationToken);
            Layout.Assert(outDir.FullName, component, version);
        }
        finally
        {
            File.Delete(tempPath);
        }
    }
}
