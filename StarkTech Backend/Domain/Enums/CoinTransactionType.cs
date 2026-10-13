namespace Domain.Enums;

public enum CoinTransactionType
{
    Earned = 0,
    Redeemed = 1,
    ManualAdjustment = 2,
    /// <summary>Возврат списанных монет при отмене заказа.</summary>
    Refunded = 3
}
