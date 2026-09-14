using Application.Result;

namespace Application.DTOs.ProductVariant;

public class GetProductVariantFilterDto : PageRequest
{
    public Guid? ProductId { get; set; }
    public bool? IsActive { get; set; }
}
