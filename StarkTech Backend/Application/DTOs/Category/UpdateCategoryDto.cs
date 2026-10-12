namespace Application.DTOs.Category;

public class UpdateCategoryDto
{
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? DescriptionRu { get; set; }
    public string? DescriptionTj { get; set; }
    public string? DescriptionEn { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}
