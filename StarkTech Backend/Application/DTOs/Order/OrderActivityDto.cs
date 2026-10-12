namespace Application.DTOs.Order;

public class OrderActivityDto
{
    public Guid Id { get; set; }
    public string Message { get; set; } = default!;
    public bool ByClient { get; set; }
    public bool IsSeen { get; set; }
    public DateTime CreatedAt { get; set; }
}
