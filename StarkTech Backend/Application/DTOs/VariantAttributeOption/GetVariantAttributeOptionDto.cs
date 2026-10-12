namespace Application.DTOs.VariantAttributeOption;

public class GetVariantAttributeOptionDto
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string AttributeKey { get; set; } = default!;
    public string AttributeValue { get; set; } = default!;
    public decimal? PriceModifier { get; set; }
    public int SortOrder { get; set; }
}
