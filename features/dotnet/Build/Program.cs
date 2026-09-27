using System.CommandLine;
using System.Runtime.Versioning;
using DevcontainerConfig.Dotnet.Build;

[assembly: SupportedOSPlatform("linux")]

Option<FileInfo> configOption = new("--config") { Required = true, Description = "Path to the feature config.json." };
Option<string> componentOption = new("--component")
{
    Required = true,
    Description = "Component to stage: sdk, runtime or aspnet.",
};
Option<string> versionOption = new("--version")
{
    Required = true,
    Description = "Pinned component version in config.json.",
};
Option<string> archOption = new("--arch")
{
    Required = true,
    Description = "Docker target architecture: amd64 or arm64.",
};
Option<DirectoryInfo> outOption = new("--out")
{
    Required = true,
    Description = "Directory to extract the artifact into.",
};

RootCommand root = new("Download, verify and extract a pinned .NET payload artifact.")
{
    configOption,
    componentOption,
    versionOption,
    archOption,
    outOption,
};
root.Options.Remove(root.Options.OfType<VersionOption>().Single());
root.SetAction(
    async (parseResult, cancellationToken) =>
    {
        try
        {
            await Staging.RunAsync(
                parseResult.GetRequiredValue(configOption),
                parseResult.GetRequiredValue(componentOption),
                parseResult.GetRequiredValue(versionOption),
                parseResult.GetRequiredValue(archOption),
                parseResult.GetRequiredValue(outOption),
                cancellationToken
            );
            return 0;
        }
        catch (Exception e)
        {
            Console.Error.WriteLine($"build: {e.Message.ReplaceLineEndings(" ")}");
            return 1;
        }
    }
);

return await root.Parse(args).InvokeAsync();
