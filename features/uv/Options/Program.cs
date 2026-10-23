using System.Text.Json.Nodes;
using DevcontainerConfig.Features;
using DevcontainerConfig.Uv;

JsonNode schema = OptionsSchema.Of(OptionsContext.Default.FeatureOptions);
Console.WriteLine(schema.ToJsonString());
