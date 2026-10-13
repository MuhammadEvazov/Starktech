namespace Domain.Common;

/// <summary>
/// Время магазина — Душанбе (UTC+5, без перехода на летнее время). В базе всё хранится в UTC;
/// местное время нужно для номеров заказов («заказ от 13 октября»), сроков промокодов и фильтров по датам.
/// </summary>
public static class ShopClock
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(5);

    public static DateTime LocalNow => DateTime.UtcNow + Offset;
    public static DateTime LocalToday => LocalNow.Date;

    /// <summary>UTC → местное время Душанбе.</summary>
    public static DateTime ToLocal(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc) + Offset;

    /// <summary>
    /// Дата/время из формы админки (без зоны — это местное время Душанбе) → UTC для базы.
    /// Значение с Kind=Utc считается уже переведённым.
    /// </summary>
    public static DateTime FromLocal(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value - Offset, DateTimeKind.Utc)
    };
}
