using Application.DTOs.Payment;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IPaymentService
{
    Task<Result<PaymentSettingsDto>> GetSettingsAsync();
    Task<Result<PaymentSettingsDto>> UpdateSettingsAsync(UpdatePaymentSettingsDto dto);

    /// <summary>Чеки заказа. ownerId задан — только если заказ принадлежит этому клиенту.</summary>
    Task<Result<List<PaymentProofDto>>> GetProofsAsync(Guid orderId, Guid? ownerId);
    Task<Result<PaymentProofDto>> UploadProofAsync(Guid orderId, Guid ownerId, IFormFile? file, decimal amount, string? comment);
    Task<Result<PaymentProofDto>> ApproveAsync(Guid proofId, decimal? amount, string reviewer);
    Task<Result<PaymentProofDto>> RejectAsync(Guid proofId, string reason, string reviewer);
}
