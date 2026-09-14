using Application.Result;

namespace Application.DTOs.PortfolioItem;

public class GetPortfolioItemFilterDto : PageRequest
{
    public Guid? CategoryId { get; set; }
    public bool? IsActive { get; set; }
}
