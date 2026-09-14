namespace Application.DTOs.Order;

public class AddOrderItemDto
{
    public Guid ProductVariantId { get; set; }
    public int Quantity { get; set; }
}
