using Application.Result;

namespace Application.DTOs.DeliveryCity;

public class GetDeliveryCityFilterDto : PageRequest
{
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
}
