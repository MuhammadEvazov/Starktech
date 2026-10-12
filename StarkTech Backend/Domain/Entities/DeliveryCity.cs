namespace Domain.Entities;

public class DeliveryCity : BaseEntity
{
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public decimal DeliveryCost { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
