namespace Application.DTOs.OrderItemPhoto;

public class GetOrderItemPhotoDto
{
    public Guid Id { get; set; }
    public Guid OrderItemId { get; set; }
    public string OriginalPhotoUrl { get; set; } = default!;
    public string? EditedPreviewUrl { get; set; }
    public string? CropDataJson { get; set; }
    public int Copies { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
}
