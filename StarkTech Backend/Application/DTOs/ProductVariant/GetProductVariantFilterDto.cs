using Application.Result;

namespace Application.DTOs.ProductVariant;

public class GetProductVariantFilterDto : PageRequest
{
    public Guid? ProductId { get; set; }
    public bool? IsActive { get; set; }

    /// <summary>true — только удалённые, false — только живые. Выставляет контроллер.</summary>
    public bool Deleted { get; set; }
}
