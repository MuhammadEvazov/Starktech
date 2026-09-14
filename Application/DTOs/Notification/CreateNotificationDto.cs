using Domain.Enums;

namespace Application.DTOs.Notification;

public class CreateNotificationDto
{
    public Guid? OrderId { get; set; }
    public NotificationChannel Channel { get; set; }
    public NotificationStatus Status { get; set; }
    public string? Payload { get; set; }
}
