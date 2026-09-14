using Application.Result;

namespace Application.DTOs.ComboOffer;

public class GetComboOfferFilterDto : PageRequest
{
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
}
