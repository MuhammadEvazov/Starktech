using Application.DTOs.Payment;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

/// <summary>
/// Оплата переводом: реквизиты магазина, чеки клиентов и их проверка.
/// Реквизиты меняет только суперадмин (finance.view) — защита от подмены номера карты.
/// </summary>
[Authorize]
public class PaymentController : BaseController
{
    private readonly IPaymentService _payments;

    public PaymentController(IPaymentService payments)
    {
        _payments = payments;
    }

    private async Task<string> ReviewerNameAsync()
    {
        var appUserId = GetCurrentUserId();
        var users = HttpContext.RequestServices.GetRequiredService<IUserRepository>();
        var profile = appUserId == null ? null : await users.GetByIdAsync(appUserId);
        return profile?.FullName ?? "Сотрудник";
    }

    // Реквизиты нужны покупателю при оплате — доступны любому вошедшему.
    [HttpGet("api/payments/settings")]
    public async Task<IActionResult> GetSettings()
        => HandleResult(await _payments.GetSettingsAsync());

    [HttpPut("api/payments/settings")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.FinanceView)]
    public async Task<IActionResult> UpdateSettings(UpdatePaymentSettingsDto dto)
        => HandleResult(await _payments.UpdateSettingsAsync(dto));

    // ── Клиент: свои чеки ──
    [HttpGet("api/orders/my/{orderId:guid}/payment-proofs")]
    public async Task<IActionResult> MyProofs(Guid orderId)
    {
        var profileId = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        return HandleResult(await _payments.GetProofsAsync(orderId, profileId));
    }

    [HttpPost("api/orders/my/{orderId:guid}/payment-proofs")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadProof(Guid orderId, IFormFile? file, [FromForm] string? amount, [FromForm] string? comment)
    {
        // Число из формы разбираем сами: привязка модели зависит от языка сервера, а клиент может прислать «20,5».
        if (!decimal.TryParse((amount ?? string.Empty).Replace(',', '.').Replace(" ", string.Empty),
                System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var value))
            return BadRequest(new[] { "Укажите сумму перевода" });

        var profileId = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        return HandleResult(await _payments.UploadProofAsync(orderId, profileId, file, value, comment));
    }

    // ── Сотрудник: проверка чеков ──
    [HttpGet("api/orders/{orderId:guid}/payment-proofs")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> Proofs(Guid orderId)
        => HandleResult(await _payments.GetProofsAsync(orderId, null));

    [HttpPost("api/payment-proofs/{id:guid}/approve")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> Approve(Guid id, ApprovePaymentProofDto dto)
        => HandleResult(await _payments.ApproveAsync(id, dto.Amount, await ReviewerNameAsync()));

    [HttpPost("api/payment-proofs/{id:guid}/reject")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> Reject(Guid id, RejectPaymentProofDto dto)
        => HandleResult(await _payments.RejectAsync(id, dto.Reason, await ReviewerNameAsync()));
}
