namespace Application.DTOs.ProductVariant;

public class UpdateProductVariantDto
{
    public string AttributesJson { get; set; } = "{}";
    public decimal Price { get; set; }
    public bool StockUnlimited { get; set; }
    public string? SKU { get; set; }
    public bool IsActive { get; set; }
}
