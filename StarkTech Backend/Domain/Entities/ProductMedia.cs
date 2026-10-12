namespace Domain.Entities;

/// <summary>
/// Фото или видео в галерее товара. Без варианта — общая галерея товара,
/// с вариантом — галерея конкретного варианта (форма, размер).
/// </summary>
public class ProductMedia : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public Guid? ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }

    public string Url { get; set; } = default!;
    public bool IsVideo { get; set; }
    public int SortOrder { get; set; }
}
