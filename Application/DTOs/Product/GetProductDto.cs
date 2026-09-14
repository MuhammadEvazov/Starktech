namespace Application.DTOs.Product;

public class GetProductDto
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public string? DescriptionRu { get; set; }
    public string? DescriptionTj { get; set; }
    public string? DescriptionEn { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; }
    public string? MainImageUrl { get; set; }
    public bool RequiresPhotoUpload { get; set; }
}
