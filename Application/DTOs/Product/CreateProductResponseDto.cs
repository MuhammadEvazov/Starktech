namespace Application.DTOs.Product;

public class CreateProductResponseDto
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public decimal BasePrice { get; set; }
}
