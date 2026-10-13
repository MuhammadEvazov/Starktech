using System.ComponentModel.DataAnnotations;
using Domain.Enums;

namespace Application.DTOs.Payment;

public class PaymentSettingsDto
{
    public int PrepaymentPercent { get; set; }
    public bool PrepaymentForCash { get; set; }
    public bool CashEnabled { get; set; }

    public bool KortiMilliEnabled { get; set; }
    public string? KortiMilliCard { get; set; }
    public string? KortiMilliHolder { get; set; }

    public bool AlifPayEnabled { get; set; }
    public string? AlifPayPhone { get; set; }
    public string? AlifPayHolder { get; set; }

    public bool CardTransferEnabled { get; set; }
    public string? CardTransferNumber { get; set; }
    public string? CardTransferHolder { get; set; }
    public string? CardTransferBank { get; set; }

    public string? Instructions { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdatePaymentSettingsDto
{
    [Range(0, 100)]
    public int PrepaymentPercent { get; set; }
    public bool PrepaymentForCash { get; set; }
    public bool CashEnabled { get; set; } = true;

    public bool KortiMilliEnabled { get; set; }
    [MaxLength(40)] public string? KortiMilliCard { get; set; }
    [MaxLength(120)] public string? KortiMilliHolder { get; set; }

    public bool AlifPayEnabled { get; set; }
    [MaxLength(40)] public string? AlifPayPhone { get; set; }
    [MaxLength(120)] public string? AlifPayHolder { get; set; }

    public bool CardTransferEnabled { get; set; }
    [MaxLength(40)] public string? CardTransferNumber { get; set; }
    [MaxLength(120)] public string? CardTransferHolder { get; set; }
    [MaxLength(120)] public string? CardTransferBank { get; set; }

    [MaxLength(1000)] public string? Instructions { get; set; }
}

public class PaymentProofDto
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string? Comment { get; set; }
    public PaymentProofStatus Status { get; set; }
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedBy { get; set; }
}

public class ApprovePaymentProofDto
{
    /// <summary>Принятая сумма; пусто — сумма, указанная клиентом.</summary>
    [Range(0.01, 100000000)]
    public decimal? Amount { get; set; }
}

public class RejectPaymentProofDto
{
    [Required, MaxLength(300)]
    public string Reason { get; set; } = string.Empty;
}
