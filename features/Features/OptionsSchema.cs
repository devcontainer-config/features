using System.ComponentModel;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization.Metadata;

namespace DevcontainerConfig.Features;

public static class OptionsSchema
{
    private static readonly JsonSchemaExporterOptions ExporterOptions = new()
    {
        TreatNullObliviousAsNonNullable = true,
        TransformSchemaNode = (context, node) =>
        {
            if (context.PropertyInfo is not { AttributeProvider: { } provider } property)
            {
                return node;
            }
            if (provider.GetCustomAttributes(typeof(DescriptionAttribute), false) is [DescriptionAttribute description])
            {
                ((JsonObject)node)["description"] = description.Description;
            }
            if (
                provider.GetCustomAttributes(typeof(DefaultValueAttribute), false)
                is [DefaultValueAttribute defaultValue]
            )
            {
                ((JsonObject)node)["default"] = JsonSerializer.SerializeToNode(
                    defaultValue.Value,
                    property.Options.GetTypeInfo(property.PropertyType)
                );
            }
            return node;
        },
    };

    public static JsonNode Of(JsonTypeInfo typeInfo) =>
        JsonSchemaExporter.GetJsonSchemaAsNode(typeInfo, ExporterOptions);
}
