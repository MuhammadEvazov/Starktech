using Domain.Enums;

namespace Application.DTOs.Order;

public class GetOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = default!;
    public Guid? UserId { get; set; }
    public OrderStatus Status { get; set; }

    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryCost { get; set; }
    public decimal PayableAmount { get; set; }

    public Guid? PromoCodeId { get; set; }
    public Guid? ComboOfferId { get; set; }

    public Guid? DeliveryCityId { get; set; }
    public string? DeliveryAddress { get; set; }

    public string ContactName { get; set; } = default!;
    public string ContactPhone { get; set; } = default!;
    public string? ContactEmail { get; set; }

    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public OrderSource Source { get; set; }

    public int CoinsEarned { get; set; }
    public int CoinsUsed { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<OrderItemDto> Items { get; set; } = new();
}
