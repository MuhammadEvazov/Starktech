using Application.Result;

namespace Application.DTOs.VariantAttributeOption;

public class GetVariantAttributeOptionFilterDto : PageRequest
{
    public Guid? CategoryId { get; set; }
    public string? AttributeKey { get; set; }
}
