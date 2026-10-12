namespace Application.DTOs.DeliveryCity;

public class CreateDeliveryCityResponseDto
{
    public Guid Id { get; set; }
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public decimal DeliveryCost { get; set; }
}
