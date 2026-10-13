namespace Application.DTOs.Product;

/// <summary>Ступень скидки за количество: от MinQuantity штук одной позиции — минус DiscountPercent %.</summary>
public class QuantityTierDto
{
    public int MinQuantity { get; set; }
    public decimal DiscountPercent { get; set; }
}
