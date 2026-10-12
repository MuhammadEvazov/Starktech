using Application.Result;

namespace Application.DTOs.Category;

public class GetCategoryFilterDto : PageRequest
{
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
}
