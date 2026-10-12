namespace Domain.Entities;

public class Product : BaseEntity
{
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = default!;

    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public string? DescriptionRu { get; set; }
    public string? DescriptionTj { get; set; }
    public string? DescriptionEn { get; set; }

    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; } = true;
    public string? MainImageUrl { get; set; }
    public bool RequiresPhotoUpload { get; set; } = true;

    // Мягкое удаление: товар пропадает из каталога и админки, но остаётся в старых заказах
    // и может быть восстановлен.
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }

    // Navigation
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
}
