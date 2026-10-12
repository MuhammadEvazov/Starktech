using Domain.Enums;

namespace Domain.Entities;

public class Notification : BaseEntity
{
    public Guid? OrderId { get; set; }
    public Order? Order { get; set; }

    public NotificationChannel Channel { get; set; }
    public NotificationStatus Status { get; set; }
    public string? Payload { get; set; }
}
