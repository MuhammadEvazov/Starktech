namespace Domain.Entities;

public class VariantAttributeOption : BaseEntity
{
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = default!;

    public string AttributeKey { get; set; } = default!;   // "size" | "shape" | "phoneModel" | "quantity"
    public string AttributeValue { get; set; } = default!;
    public decimal? PriceModifier { get; set; }
    public int SortOrder { get; set; }
}
