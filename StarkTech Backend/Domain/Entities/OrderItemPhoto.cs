namespace Domain.Entities;

public class OrderItemPhoto : BaseEntity
{
    public Guid OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = default!;

    public string OriginalPhotoUrl { get; set; } = default!;
    public string? EditedPreviewUrl { get; set; }
    public string? CropDataJson { get; set; } // координаты/масштаб редактирования

    // Сколько стикеров печатать с этого фото (сумма по позиции не больше OrderItem.Quantity)
    public int Copies { get; set; } = 1;

    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
}
