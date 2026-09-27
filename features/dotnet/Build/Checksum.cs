using System.Security.Cryptography;

namespace DevcontainerConfig.Dotnet.Build;

internal static class Checksum
{
    internal static async Task VerifyAsync(string tempPath, string sha512, CancellationToken cancellationToken)
    {
        await using FileStream stream = File.OpenRead(tempPath);
        string actual = Convert.ToHexStringLower(await SHA512.HashDataAsync(stream, cancellationToken));

        if (!string.Equals(actual, sha512, StringComparison.OrdinalIgnoreCase))
        {
            throw new BuildException($"sha512 mismatch: expected {sha512}, actual {actual}.");
        }
    }
}
