namespace Application.DTOs.ProductVariant;

public class GetProductVariantDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string AttributesJson { get; set; } = "{}";
    public decimal Price { get; set; }
    public bool StockUnlimited { get; set; }
    public string? SKU { get; set; }
    public bool IsActive { get; set; }
    public string? ImageUrl { get; set; }
    public DateTime? DeletedAt { get; set; }
}
