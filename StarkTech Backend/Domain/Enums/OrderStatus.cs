namespace Domain.Enums;

public enum OrderStatus
{
    New = 0,
    Confirmed = 1,
    InProduction = 2,
    ReadyForDelivery = 3,
    Delivered = 4,
    Cancelled = 5,
    /// <summary>Менеджер отправил макет, ждём подтверждения клиента (необязательный шаг между Confirmed и InProduction).</summary>
    AwaitingLayoutApproval = 6
}
