using Domain.Enums;

namespace Application.DTOs.PromoCode;

public class GetPromoCodeDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = default!;
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public int? MaxUsages { get; set; }
    /// <summary>Сколько раз один клиент может применить код (null — без ограничения).</summary>
    public int? MaxUsagesPerUser { get; set; }
    public int UsedCount { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
    public bool IsActive { get; set; }
}
