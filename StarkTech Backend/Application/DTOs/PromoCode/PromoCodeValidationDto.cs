using Domain.Enums;

namespace Application.DTOs.PromoCode;

/// <summary>Ответ GET /api/promo-codes/validate?code=… — промокод можно применить к заказу текущего клиента.</summary>
public class PromoCodeValidationDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = default!;
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
}
