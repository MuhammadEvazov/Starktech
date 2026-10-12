namespace Domain.Entities;

public class PortfolioItem : BaseEntity
{
    public string ImageUrl { get; set; } = default!;

    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }

    public string? DescriptionRu { get; set; }
    public string? DescriptionTj { get; set; }
    public string? DescriptionEn { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
