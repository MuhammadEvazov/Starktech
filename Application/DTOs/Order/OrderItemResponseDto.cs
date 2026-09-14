namespace Application.DTOs.Order;

public class OrderItemResponseDto
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductVariantId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }
    public decimal OrderTotalAmount { get; set; }
    public decimal OrderPayableAmount { get; set; }
}
