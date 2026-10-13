using Domain.Enums;

namespace Application.DTOs.Order;

public class UpdateOrderStatusDto
{
    public OrderStatus Status { get; set; }
    public PaymentStatus? PaymentStatus { get; set; }

    /// <summary>Перевести в «Согласование макета»/«В производстве», даже если у позиций не хватает фото.</summary>
    public bool IgnoreMissingPhotos { get; set; }
}
