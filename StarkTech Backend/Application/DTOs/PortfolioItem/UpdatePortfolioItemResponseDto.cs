namespace Application.DTOs.PortfolioItem;

public class UpdatePortfolioItemResponseDto
{
    public Guid Id { get; set; }
    public string ImageUrl { get; set; } = default!;
    public Guid? CategoryId { get; set; }
    public bool IsActive { get; set; }
}
