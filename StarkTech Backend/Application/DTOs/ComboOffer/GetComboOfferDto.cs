using Domain.Enums;

namespace Application.DTOs.ComboOffer;

public class GetComboOfferDto
{
    public Guid Id { get; set; }
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public string ProductIdsJson { get; set; } = "[]";
    public bool IsActive { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
}
