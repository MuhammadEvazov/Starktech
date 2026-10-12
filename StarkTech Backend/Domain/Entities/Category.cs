namespace Domain.Entities;

public class Category : BaseEntity
{
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? DescriptionRu { get; set; }
    public string? DescriptionTj { get; set; }
    public string? DescriptionEn { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    // Navigation
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<VariantAttributeOption> AttributeOptions { get; set; } = new List<VariantAttributeOption>();
    public ICollection<PortfolioItem> PortfolioItems { get; set; } = new List<PortfolioItem>();
}
