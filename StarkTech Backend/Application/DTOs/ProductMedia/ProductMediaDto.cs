namespace Application.DTOs.ProductMedia;

public class ProductMediaDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    /// <summary>null — общая галерея товара.</summary>
    public Guid? ProductVariantId { get; set; }
    public string Url { get; set; } = default!;
    public bool IsVideo { get; set; }
    public int SortOrder { get; set; }
}

public class ReorderProductMediaDto
{
    /// <summary>Id файлов одной галереи в новом порядке.</summary>
    public List<Guid> Ids { get; set; } = new();
}
