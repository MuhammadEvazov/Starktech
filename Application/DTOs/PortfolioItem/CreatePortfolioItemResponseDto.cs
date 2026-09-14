namespace Application.DTOs.PortfolioItem;

public class CreatePortfolioItemResponseDto
{
    public Guid Id { get; set; }
    public string ImageUrl { get; set; } = default!;
    public Guid? CategoryId { get; set; }
}
