namespace Application.DTOs.VariantAttributeOption;

public class CreateVariantAttributeOptionResponseDto
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string AttributeKey { get; set; } = default!;
    public string AttributeValue { get; set; } = default!;
}
