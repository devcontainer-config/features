namespace DevcontainerConfig.Dotnet.Build;

internal static class Staging
{
    internal static async Task RunAsync(
        string config,
        string component,
        string key,
        string arch,
        DirectoryInfo outDir,
        CancellationToken cancellationToken
    )
    {
        string json = await File.ReadAllTextAsync(config, cancellationToken);
        FeatureConfig feature = Config.Parse(json, config);
        PayloadSection section = Config.Section(feature, config, component, key);
        Artifact artifact = Resolution.Resolve(section, arch);
        string tempPath = Path.Join(Path.GetTempPath(), $"dotnet-build-{Guid.NewGuid():N}");
        try
        {
            await Http.DownloadAsync(tempPath, artifact.Url, cancellationToken);
            await Checksum.VerifyAsync(tempPath, artifact.Sha512, cancellationToken);
            await Tarball.ExtractAsync(tempPath, outDir, cancellationToken);
            Layout.Assert(outDir.FullName, section.Component, section.Key);
        }
        finally
        {
            File.Delete(tempPath);
        }
    }
}
