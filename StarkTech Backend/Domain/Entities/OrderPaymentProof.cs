using Domain.Enums;

namespace Domain.Entities;

/// <summary>Скриншот чека перевода, который клиент загрузил к заказу; сотрудник принимает или отклоняет.</summary>
public class OrderPaymentProof : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = default!;

    public string ImageUrl { get; set; } = default!;
    /// <summary>Сумма, которую клиент указал как переведённую.</summary>
    public decimal Amount { get; set; }
    /// <summary>Сумма, которую принял сотрудник (может отличаться от указанной).</summary>
    public decimal? ApprovedAmount { get; set; }
    public string? Comment { get; set; }

    public PaymentProofStatus Status { get; set; } = PaymentProofStatus.Pending;
    public string? RejectReason { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedBy { get; set; }
}
