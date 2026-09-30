using System.ComponentModel;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization.Metadata;

namespace DevcontainerConfig.Features;

public static class OptionsSchema
{
    private static readonly JsonSchemaExporterOptions ExporterOptions = new()
    {
        TransformSchemaNode = (context, node) =>
        {
            if (
                context.PropertyInfo?.AttributeProvider?.GetCustomAttributes(typeof(DescriptionAttribute), false)
                is [DescriptionAttribute description]
            )
            {
                ((JsonObject)node)["description"] = description.Description;
            }
            return node;
        },
    };

    public static JsonNode Of(JsonTypeInfo typeInfo) =>
        JsonSchemaExporter.GetJsonSchemaAsNode(typeInfo, ExporterOptions);
}
