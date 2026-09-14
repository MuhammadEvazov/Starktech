namespace Application.DTOs.ProductVariant;

public class CreateProductVariantDto
{
    public Guid ProductId { get; set; }
    public string AttributesJson { get; set; } = "{}";
    public decimal Price { get; set; }
    public bool StockUnlimited { get; set; } = true;
    public string? SKU { get; set; }
}
