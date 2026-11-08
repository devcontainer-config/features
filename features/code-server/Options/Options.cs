using System.ComponentModel;
using System.Text.Json.Serialization;
using DevcontainerConfig.Features;

namespace DevcontainerConfig.CodeServer;

public sealed class Options(
    string auth = "none",
    string host = "127.0.0.1",
    int port = 8080,
    string socket = "",
    string socketMode = "0600",
    string workspace = "",
    string passwordFile = "",
    string hashedPasswordFile = "",
    string githubAuthTokenFile = "",
    bool disableTelemetry = true,
    bool disableUpdateCheck = true,
    bool disableWorkspaceTrust = true,
    bool disableFileDownloads = false,
    bool disableFileUploads = false,
    string[] proxyDomain = null!,
    string absProxyBasePath = "",
    string[] trustedOrigins = null!,
    bool disableProxy = false,
    string locale = "",
    bool verbose = false,
    string[] args = null!
)
{
    [JsonPropertyName("auth")]
    [Description(
        "The authentication type, none or password. The default none gives anything that can reach the listen address the remote user's access."
    )]
    public string Auth { get; } = auth;

    [JsonPropertyName("host")]
    [Description("The address in --bind-addr when socket is empty. The default keeps the server on loopback.")]
    public string Host { get; } = host;

    [JsonPropertyName("port")]
    [Description("The port in --bind-addr when socket is empty.")]
    public int Port { get; } = port;

    [JsonPropertyName("socket")]
    [Description("An absolute Unix socket path. When set, the socket is used instead of host and port.")]
    public string Socket { get; } = socket;

    [JsonPropertyName("socketMode")]
    [Description("The file mode of the Unix socket, as octal digits. Used only when socket is set.")]
    public string SocketMode { get; } = socketMode;

    [JsonPropertyName("workspace")]
    [Description("The positional workspace path. An empty value uses the hook's current directory.")]
    public string Workspace { get; } = workspace;

    [JsonPropertyName("passwordFile")]
    [Description("A file read at postStart into PASSWORD. Trailing newlines are removed.")]
    public string PasswordFile { get; } = passwordFile;

    [JsonPropertyName("hashedPasswordFile")]
    [Description("A file read at postStart into HASHED_PASSWORD. Takes precedence over passwordFile.")]
    public string HashedPasswordFile { get; } = hashedPasswordFile;

    [JsonPropertyName("githubAuthTokenFile")]
    [Description("A file read at postStart into GITHUB_TOKEN.")]
    public string GithubAuthTokenFile { get; } = githubAuthTokenFile;

    [JsonPropertyName("disableTelemetry")]
    [Description("Pass --disable-telemetry.")]
    public bool DisableTelemetry { get; } = disableTelemetry;

    [JsonPropertyName("disableUpdateCheck")]
    [Description("Pass --disable-update-check.")]
    public bool DisableUpdateCheck { get; } = disableUpdateCheck;

    [JsonPropertyName("disableWorkspaceTrust")]
    [Description("Pass --disable-workspace-trust.")]
    public bool DisableWorkspaceTrust { get; } = disableWorkspaceTrust;

    [JsonPropertyName("disableFileDownloads")]
    [Description("Pass --disable-file-downloads.")]
    public bool DisableFileDownloads { get; } = disableFileDownloads;

    [JsonPropertyName("disableFileUploads")]
    [Description("Pass --disable-file-uploads.")]
    public bool DisableFileUploads { get; } = disableFileUploads;

    [JsonPropertyName("proxyDomain")]
    [Description("One --proxy-domain argument per element.")]
    [DefaultValue(new string[] { })]
    public string[] ProxyDomain { get; } = proxyDomain ?? [];

    [JsonPropertyName("absProxyBasePath")]
    [Description("Pass --abs-proxy-base-path.")]
    public string AbsProxyBasePath { get; } = absProxyBasePath;

    [JsonPropertyName("trustedOrigins")]
    [Description("One --trusted-origins argument per element.")]
    [DefaultValue(new string[] { })]
    public string[] TrustedOrigins { get; } = trustedOrigins ?? [];

    [JsonPropertyName("disableProxy")]
    [Description("Pass --disable-proxy.")]
    public bool DisableProxy { get; } = disableProxy;

    [JsonPropertyName("locale")]
    [Description("Pass --locale.")]
    public string Locale { get; } = locale;

    [JsonPropertyName("verbose")]
    [Description("Pass --verbose.")]
    public bool Verbose { get; } = verbose;

    [JsonPropertyName("args")]
    [Description("One code-server argument per element, appended after the option-derived arguments.")]
    [DefaultValue(new string[] { })]
    public string[] Args { get; } = args ?? [];

    public void Validate()
    {
        if (Auth is not ("none" or "password"))
        {
            throw new FeatureException($"auth must be none or password, got {Auth}");
        }
        if (Port is < 1 or > 65535)
        {
            throw new FeatureException($"port must be between 1 and 65535, got {Port}");
        }
        if (Socket.Length > 0 && !Path.IsPathRooted(Socket))
        {
            throw new FeatureException($"socket must be an absolute path, got {Socket}");
        }
        if (Socket.Length > 0 && !IsOctalMode(SocketMode))
        {
            throw new FeatureException($"socketMode must be one to four octal digits, got {SocketMode}");
        }
        if (Socket.Length > 0 && Path.GetDirectoryName(Socket) is not { Length: > 0 })
        {
            throw new FeatureException($"socket must include a parent directory, got {Socket}");
        }
        ValidateElements("proxyDomain", ProxyDomain);
        ValidateElements("trustedOrigins", TrustedOrigins);
        ValidateElements("args", Args);
    }

    private static void ValidateElements(string name, string[] values)
    {
        if (Array.Exists(values, value => value is null))
        {
            throw new FeatureException($"{name} must not contain null elements");
        }
    }

    private static bool IsOctalMode(string value) =>
        value.Length is >= 1 and <= 4 && value.All(digit => digit is >= '0' and <= '7');
}

[JsonSourceGenerationOptions(
    UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    RespectNullableAnnotations = true
)]
[JsonSerializable(typeof(Options), TypeInfoPropertyName = "FeatureOptions")]
public sealed partial class OptionsContext : JsonSerializerContext;
