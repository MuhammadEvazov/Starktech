namespace Application.DTOs.DeliveryCity;

public class UpdateDeliveryCityDto
{
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public decimal DeliveryCost { get; set; }
    public bool IsActive { get; set; }
}
