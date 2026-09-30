namespace DevcontainerConfig.Dotnet.Install;

internal static class Permissions
{
    internal const UnixFileMode Mode0644 =
        UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead;
}
