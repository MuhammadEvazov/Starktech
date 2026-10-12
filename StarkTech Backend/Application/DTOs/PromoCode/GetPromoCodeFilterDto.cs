using Application.Result;

namespace Application.DTOs.PromoCode;

public class GetPromoCodeFilterDto : PageRequest
{
    public string? Code { get; set; }
    public bool? IsActive { get; set; }
}
