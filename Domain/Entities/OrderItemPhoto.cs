namespace Domain.Entities;

public class OrderItemPhoto : BaseEntity
{
    public Guid OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = default!;

    public string OriginalPhotoUrl { get; set; } = default!;
    public string? EditedPreviewUrl { get; set; }
    public string? CropDataJson { get; set; } // координаты/масштаб редактирования

    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
}
