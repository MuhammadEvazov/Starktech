using System.Text.Json;

namespace Domain.Common;

/// <summary>Ступень скидки за количество: от MinQuantity штук одной позиции — минус DiscountPercent %.</summary>
public record QuantityTier(int MinQuantity, decimal DiscountPercent);

/// <summary>
/// Скидки за количество хранятся у товара в Product.QuantityTiersJson.
/// Единая логика для бэкенда: цена позиции = цена варианта × (1 − процент лучшей подходящей ступени),
/// округление до 2 знаков (MidpointRounding.AwayFromZero).
/// </summary>
public static class QuantityTiers
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static List<QuantityTier> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<QuantityTier>();
        try
        {
            return (JsonSerializer.Deserialize<List<QuantityTier>>(json, Json) ?? new List<QuantityTier>())
                .Where(t => t.MinQuantity >= 2 && t.DiscountPercent > 0 && t.DiscountPercent < 100)
                .OrderBy(t => t.MinQuantity)
                .ToList();
        }
        catch (JsonException)
        {
            return new List<QuantityTier>();
        }
    }

    public static string? Serialize(IEnumerable<QuantityTier>? tiers)
    {
        var list = (tiers ?? Enumerable.Empty<QuantityTier>())
            .Where(t => t.MinQuantity >= 2 && t.DiscountPercent > 0 && t.DiscountPercent < 100)
            .GroupBy(t => t.MinQuantity)
            .Select(g => g.Last())
            .OrderBy(t => t.MinQuantity)
            .ToList();
        return list.Count == 0 ? null : JsonSerializer.Serialize(list, Json);
    }

    /// <summary>Процент скидки для количества (0 — ступени нет).</summary>
    public static decimal PercentFor(string? json, int quantity)
        => Parse(json).Where(t => quantity >= t.MinQuantity).Select(t => t.DiscountPercent).DefaultIfEmpty(0).Max();

    /// <summary>Цена за штуку с учётом ступени.</summary>
    public static decimal UnitPrice(decimal price, string? json, int quantity)
    {
        var percent = PercentFor(json, quantity);
        return percent <= 0 ? price : Math.Round(price * (100 - percent) / 100m, 2, MidpointRounding.AwayFromZero);
    }
}
