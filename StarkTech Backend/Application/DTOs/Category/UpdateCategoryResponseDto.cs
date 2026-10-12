namespace Application.DTOs.Category;

public class UpdateCategoryResponseDto
{
    public Guid Id { get; set; }
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public bool IsActive { get; set; }
}
