namespace Domain.Entities;

/// <summary>
/// Реквизиты для оплаты переводом и правила предоплаты — одна запись на магазин.
/// Реквизиты показываются клиенту после оформления заказа.
/// </summary>
public class PaymentSettings : BaseEntity
{
    /// <summary>Постоянный Id единственной записи настроек (создаётся в DataSeed или при первом обращении).</summary>
    public static readonly Guid SingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>Сколько процентов суммы заказа клиент переводит сразу (0 — платит после подтверждения).</summary>
    public int PrepaymentPercent { get; set; } = 50;
    /// <summary>Требовать предоплату и при оплате наличными.</summary>
    public bool PrepaymentForCash { get; set; }

    public bool CashEnabled { get; set; } = true;

    public bool KortiMilliEnabled { get; set; } = true;
    public string? KortiMilliCard { get; set; }
    public string? KortiMilliHolder { get; set; }

    public bool AlifPayEnabled { get; set; } = true;
    public string? AlifPayPhone { get; set; }
    public string? AlifPayHolder { get; set; }

    public bool CardTransferEnabled { get; set; } = true;
    public string? CardTransferNumber { get; set; }
    public string? CardTransferHolder { get; set; }
    public string? CardTransferBank { get; set; }

    /// <summary>Дополнительная подсказка клиенту (например, «укажите номер заказа в комментарии»).</summary>
    public string? Instructions { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
