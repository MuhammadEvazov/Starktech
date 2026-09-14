using Application.Result;

namespace Application.DTOs.Product;

public class GetProductFilterDto : PageRequest
{
    public string? Name { get; set; }
    public Guid? CategoryId { get; set; }
    public bool? IsActive { get; set; }
}
