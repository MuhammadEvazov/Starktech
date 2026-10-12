namespace Application.DTOs.ProductVariant;

public class UpdateProductVariantResponseDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public decimal Price { get; set; }
    public string? SKU { get; set; }
    public bool IsActive { get; set; }
}
