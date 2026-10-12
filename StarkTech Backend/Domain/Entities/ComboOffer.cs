using Domain.Enums;

namespace Domain.Entities;

public class ComboOffer : BaseEntity
{
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;

    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }

    public string ProductIdsJson { get; set; } = "[]"; // Guid[] категорий/товаров, входящих в комбо
    public bool IsActive { get; set; } = true;
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }

    // Navigation
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
