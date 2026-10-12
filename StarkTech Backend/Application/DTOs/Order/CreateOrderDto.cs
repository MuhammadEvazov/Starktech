using Domain.Enums;

namespace Application.DTOs.Order;

public class CreateOrderDto
{
    public Guid? UserId { get; set; }

    public string ContactName { get; set; } = default!;
    public string ContactPhone { get; set; } = default!;
    public string? ContactEmail { get; set; }

    public Guid? DeliveryCityId { get; set; }
    public string? DeliveryAddress { get; set; }

    public PaymentMethod PaymentMethod { get; set; }
    public OrderSource Source { get; set; } = OrderSource.Website;

    public Guid? PromoCodeId { get; set; }
    public Guid? ComboOfferId { get; set; }
    public int CoinsUsed { get; set; }

    public List<CreateOrderItemDto> Items { get; set; } = new();
}
