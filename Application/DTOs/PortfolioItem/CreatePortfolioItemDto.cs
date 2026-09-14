namespace Application.DTOs.PortfolioItem;

public class CreatePortfolioItemDto
{
    public string ImageUrl { get; set; } = default!;
    public Guid? CategoryId { get; set; }
    public string? DescriptionRu { get; set; }
    public string? DescriptionTj { get; set; }
    public string? DescriptionEn { get; set; }
    public int SortOrder { get; set; }
}
