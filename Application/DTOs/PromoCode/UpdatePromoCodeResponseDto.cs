using Domain.Enums;

namespace Application.DTOs.PromoCode;

public class UpdatePromoCodeResponseDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = default!;
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public bool IsActive { get; set; }
}
