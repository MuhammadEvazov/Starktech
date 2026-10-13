using Domain.Enums;

namespace Domain.Entities;

public class PromoCode : BaseEntity
{
    public string Code { get; set; } = default!;

    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }

    public int? MaxUsages { get; set; }
    /// <summary>Сколько раз один клиент может применить код (null — без ограничения).</summary>
    public int? MaxUsagesPerUser { get; set; }
    public int UsedCount { get; set; } = 0;
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
