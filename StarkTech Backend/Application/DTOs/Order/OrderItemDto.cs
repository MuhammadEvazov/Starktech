namespace Application.DTOs.Order;

public class OrderItemDto
{
    public Guid Id { get; set; }
    public Guid ProductVariantId { get; set; }
    public Guid ProductId { get; set; }
    public string ProductNameEn { get; set; } = default!;
    public string? SKU { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }
}
