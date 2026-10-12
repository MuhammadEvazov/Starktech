using Domain.Enums;

namespace Application.DTOs.ComboOffer;

public class CreateComboOfferResponseDto
{
    public Guid Id { get; set; }
    public string NameRu { get; set; } = default!;
    public string NameTj { get; set; } = default!;
    public string NameEn { get; set; } = default!;
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
}
