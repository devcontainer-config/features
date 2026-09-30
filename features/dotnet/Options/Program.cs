using System.Text.Json.Nodes;
using DevcontainerConfig.Dotnet;
using DevcontainerConfig.Features;

JsonNode schema = OptionsSchema.Of(OptionsContext.Default.FeatureOptions);
Console.WriteLine(schema.ToJsonString());
