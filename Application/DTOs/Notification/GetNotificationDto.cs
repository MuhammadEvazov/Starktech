using Domain.Enums;

namespace Application.DTOs.Notification;

public class GetNotificationDto
{
    public Guid Id { get; set; }
    public Guid? OrderId { get; set; }
    public string? OrderNumber { get; set; }
    public NotificationChannel Channel { get; set; }
    public NotificationStatus Status { get; set; }
    public string? Payload { get; set; }
    public DateTime CreatedAt { get; set; }
}
