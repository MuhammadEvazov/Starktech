using Application.Result;
using Domain.Enums;

namespace Application.DTOs.Notification;

public class GetNotificationFilterDto : PageRequest
{
    public Guid? OrderId { get; set; }
    public NotificationChannel? Channel { get; set; }
    public NotificationStatus? Status { get; set; }
}
