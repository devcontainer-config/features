namespace DevcontainerConfig.Features;

public static class SymbolicLink
{
    public static void Replace(string path, string target)
    {
        string temp = Path.Join(Path.GetDirectoryName(path), $".{Path.GetFileName(path)}-{Guid.NewGuid():N}");
        File.CreateSymbolicLink(temp, target);
        try
        {
            File.Move(temp, path, overwrite: true);
        }
        finally
        {
            File.Delete(temp);
        }
    }
}
