using Domain.Enums;

namespace Application.DTOs.Order;

public class CreateOrderResponseDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = default!;
    public OrderStatus Status { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryCost { get; set; }
    public decimal PayableAmount { get; set; }
}
