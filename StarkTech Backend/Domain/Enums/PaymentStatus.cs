namespace Domain.Enums;

public enum PaymentStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Refunded = 3,
    /// <summary>Принята часть суммы (например, предоплата).</summary>
    PartiallyPaid = 4
}
