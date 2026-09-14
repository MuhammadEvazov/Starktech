namespace Application.DTOs.VariantAttributeOption;

public class UpdateVariantAttributeOptionResponseDto
{
    public Guid Id { get; set; }
    public string AttributeKey { get; set; } = default!;
    public string AttributeValue { get; set; } = default!;
    public decimal? PriceModifier { get; set; }
}
