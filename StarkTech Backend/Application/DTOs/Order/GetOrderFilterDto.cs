using Application.Result;
using Domain.Enums;

namespace Application.DTOs.Order;

public class GetOrderFilterDto : PageRequest
{
    public string? OrderNumber { get; set; }
    public Guid? UserId { get; set; }
    public OrderStatus? Status { get; set; }
    public PaymentStatus? PaymentStatus { get; set; }
    public DateTime? CreatedFrom { get; set; }
    public DateTime? CreatedTo { get; set; }
}
