using Application.DTOs.Payment;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public class PaymentService : IPaymentService
{
    private readonly AppDbContext _context;
    private readonly IFileService _files;
    private readonly IOrderActivityService _activity;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOrderRepository _orders;

    public PaymentService(
        AppDbContext context,
        IFileService files,
        IOrderActivityService activity,
        IUnitOfWork unitOfWork,
        IOrderRepository orders)
    {
        _context = context;
        _files = files;
        _activity = activity;
        _unitOfWork = unitOfWork;
        _orders = orders;
    }

    private static string Money(decimal value) => $"{value:0.##} смн";

    private static decimal Round2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static string? Clean(string? value)
    {
        var v = value?.Trim();
        return string.IsNullOrEmpty(v) ? null : v;
    }

    /// <summary>Настройки оплаты без создания записи: если её ещё нет — значения по умолчанию.</summary>
    internal static async Task<PaymentSettings> ReadSettingsAsync(AppDbContext context)
        => await context.Set<PaymentSettings>().AsNoTracking().FirstOrDefaultAsync(s => s.Id == PaymentSettings.SingletonId)
           ?? new PaymentSettings { Id = PaymentSettings.SingletonId };

    /// <summary>Включён ли способ оплаты в настройках магазина.</summary>
    internal static bool IsMethodEnabled(PaymentSettings s, PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => s.CashEnabled,
        PaymentMethod.KortiMilli => s.KortiMilliEnabled,
        PaymentMethod.AlifPay => s.AlifPayEnabled,
        PaymentMethod.CardTransfer => s.CardTransferEnabled,
        _ => false
    };

    /// <summary>Процент предоплаты для нового заказа по текущим правилам магазина.</summary>
    internal static int PrepaymentPercentFor(PaymentSettings s, PaymentMethod method)
        => method == PaymentMethod.Cash && !s.PrepaymentForCash ? 0 : Math.Clamp(s.PrepaymentPercent, 0, 100);

    private async Task<PaymentSettings> GetOrCreateSettingsAsync()
    {
        var settings = await _context.Set<PaymentSettings>().FirstOrDefaultAsync(s => s.Id == PaymentSettings.SingletonId);
        if (settings != null) return settings;

        settings = new PaymentSettings { Id = PaymentSettings.SingletonId };
        _context.Add(settings);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Запись успел создать параллельный запрос — берём её.
            _context.Entry(settings).State = EntityState.Detached;
            settings = await _context.Set<PaymentSettings>().FirstAsync(s => s.Id == PaymentSettings.SingletonId);
        }
        return settings;
    }

    private static PaymentSettingsDto ToDto(PaymentSettings s) => new()
    {
        PrepaymentPercent = s.PrepaymentPercent,
        PrepaymentForCash = s.PrepaymentForCash,
        CashEnabled = s.CashEnabled,
        KortiMilliEnabled = s.KortiMilliEnabled,
        KortiMilliCard = s.KortiMilliCard,
        KortiMilliHolder = s.KortiMilliHolder,
        AlifPayEnabled = s.AlifPayEnabled,
        AlifPayPhone = s.AlifPayPhone,
        AlifPayHolder = s.AlifPayHolder,
        CardTransferEnabled = s.CardTransferEnabled,
        CardTransferNumber = s.CardTransferNumber,
        CardTransferHolder = s.CardTransferHolder,
        CardTransferBank = s.CardTransferBank,
        Instructions = s.Instructions,
        UpdatedAt = s.UpdatedAt
    };

    private static PaymentProofDto ToDto(OrderPaymentProof p) => new()
    {
        Id = p.Id,
        OrderId = p.OrderId,
        ImageUrl = p.ImageUrl,
        Amount = p.Amount,
        ApprovedAmount = p.ApprovedAmount,
        Comment = p.Comment,
        Status = p.Status,
        RejectReason = p.RejectReason,
        CreatedAt = p.CreatedAt,
        ReviewedAt = p.ReviewedAt,
        ReviewedBy = p.ReviewedBy
    };

    public async Task<Result<PaymentSettingsDto>> GetSettingsAsync()
        => Result<PaymentSettingsDto>.Ok(ToDto(await GetOrCreateSettingsAsync()));

    public async Task<Result<PaymentSettingsDto>> UpdateSettingsAsync(UpdatePaymentSettingsDto dto)
    {
        if (dto.PrepaymentPercent is < 0 or > 100)
            return Result<PaymentSettingsDto>.Fail("Предоплата — от 0 до 100%", ErrorType.Validation);
        if (!dto.CashEnabled && !dto.KortiMilliEnabled && !dto.AlifPayEnabled && !dto.CardTransferEnabled)
            return Result<PaymentSettingsDto>.Fail("Включите хотя бы один способ оплаты", ErrorType.Validation);
        if (dto.KortiMilliEnabled && Clean(dto.KortiMilliCard) == null)
            return Result<PaymentSettingsDto>.Fail("Укажите номер карты Корти Миллӣ или выключите этот способ", ErrorType.Validation);
        if (dto.AlifPayEnabled && Clean(dto.AlifPayPhone) == null)
            return Result<PaymentSettingsDto>.Fail("Укажите номер для Alif Pay или выключите этот способ", ErrorType.Validation);
        if (dto.CardTransferEnabled && Clean(dto.CardTransferNumber) == null)
            return Result<PaymentSettingsDto>.Fail("Укажите номер карты для перевода или выключите этот способ", ErrorType.Validation);

        var s = await GetOrCreateSettingsAsync();
        s.PrepaymentPercent = dto.PrepaymentPercent;
        s.PrepaymentForCash = dto.PrepaymentForCash;
        s.CashEnabled = dto.CashEnabled;
        s.KortiMilliEnabled = dto.KortiMilliEnabled;
        s.KortiMilliCard = Clean(dto.KortiMilliCard);
        s.KortiMilliHolder = Clean(dto.KortiMilliHolder);
        s.AlifPayEnabled = dto.AlifPayEnabled;
        s.AlifPayPhone = Clean(dto.AlifPayPhone);
        s.AlifPayHolder = Clean(dto.AlifPayHolder);
        s.CardTransferEnabled = dto.CardTransferEnabled;
        s.CardTransferNumber = Clean(dto.CardTransferNumber);
        s.CardTransferHolder = Clean(dto.CardTransferHolder);
        s.CardTransferBank = Clean(dto.CardTransferBank);
        s.Instructions = Clean(dto.Instructions);
        s.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Result<PaymentSettingsDto>.Ok(ToDto(s));
    }

    public async Task<Result<List<PaymentProofDto>>> GetProofsAsync(Guid orderId, Guid? ownerId)
    {
        var exists = await _context.Orders.AnyAsync(o => o.Id == orderId && (ownerId == null || o.UserId == ownerId));
        if (!exists)
            return Result<List<PaymentProofDto>>.Fail("Order not found", ErrorType.NotFound);

        var proofs = await _context.Set<OrderPaymentProof>().AsNoTracking()
            .Where(p => p.OrderId == orderId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
        return Result<List<PaymentProofDto>>.Ok(proofs.Select(ToDto).ToList());
    }

    // Проверки суммы чека: заказ не отменён и не оплачен, сумма вместе с чеками «на проверке» не больше остатка.
    private async Task<string?> ValidateProofAmountAsync(Order order, decimal amount)
    {
        if (order.Status == OrderStatus.Cancelled)
            return "Заказ отменён — оплата не нужна";
        if (order.PaymentStatus is PaymentStatus.Paid or PaymentStatus.Refunded)
            return "Заказ уже оплачен";

        var remaining = OrderService.ComputePayable(order) - order.PaidAmount;
        if (remaining <= 0)
            return "Заказ уже оплачен";

        var pending = await _context.Set<OrderPaymentProof>()
            .Where(p => p.OrderId == order.Id && p.Status == PaymentProofStatus.Pending)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        if (pending + amount > remaining)
        {
            var left = Math.Max(0, remaining - pending);
            return pending > 0
                ? $"С учётом чеков на проверке осталось оплатить {Money(left)}"
                : $"Сумма больше, чем осталось оплатить ({Money(remaining)})";
        }

        return null;
    }

    public async Task<Result<PaymentProofDto>> UploadProofAsync(Guid orderId, Guid ownerId, IFormFile? file, decimal amount, string? comment)
    {
        amount = Round2(amount);
        if (amount < 0.01m)
            return Result<PaymentProofDto>.Fail("Укажите сумму перевода", ErrorType.Validation);

        // Быстрая проверка до сохранения файла; окончательная — под блокировкой заказа.
        var snapshot = await _context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == ownerId);
        if (snapshot == null)
            return Result<PaymentProofDto>.Fail("Order not found", ErrorType.NotFound);
        var preError = await ValidateProofAmountAsync(snapshot, amount);
        if (preError != null)
            return Result<PaymentProofDto>.Fail(preError, ErrorType.Validation);

        var fileError = _files.ValidateImage(file);
        if (fileError != null)
            return Result<PaymentProofDto>.Fail(fileError, ErrorType.Validation);

        var url = await _files.UploadAsync(file!, "payment-proofs");
        if (url == null)
            return Result<PaymentProofDto>.Fail("Не удалось сохранить чек", ErrorType.Validation);

        comment = Clean(comment);
        if (comment?.Length > 500) comment = comment[..500];

        Result<PaymentProofDto> result;
        try
        {
            result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _orders.LockForUpdateAsync(orderId);

                var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == ownerId);
                if (order == null)
                    return Result<PaymentProofDto>.Fail("Order not found", ErrorType.NotFound);

                var error = await ValidateProofAmountAsync(order, amount);
                if (error != null)
                    return Result<PaymentProofDto>.Fail(error, ErrorType.Validation);

                var proof = new OrderPaymentProof
                {
                    OrderId = order.Id,
                    ImageUrl = url,
                    Amount = amount,
                    Comment = comment
                };
                _context.Add(proof);
                order.HasPendingPaymentProof = true;
                order.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _activity.LogAsync(order.Id, $"Клиент загрузил чек оплаты на {Money(proof.Amount)}", byClient: true);
                return Result<PaymentProofDto>.Ok(ToDto(proof));
            });
        }
        catch
        {
            await _files.DeleteAsync(url);
            throw;
        }

        // Файл сохранён, а запись в базе нет — убираем «осиротевший» файл.
        if (!result.IsSuccess)
            await _files.DeleteAsync(url);

        return result;
    }

    private async Task<Guid?> ProofOrderIdAsync(Guid proofId)
        => await _context.Set<OrderPaymentProof>().AsNoTracking()
            .Where(p => p.Id == proofId)
            .Select(p => (Guid?)p.OrderId)
            .FirstOrDefaultAsync();

    // Чек под блокировкой строки заказа: повторная проверка, что он ещё «на проверке».
    private async Task<(OrderPaymentProof? Proof, Result<PaymentProofDto>? Error)> LoadPendingLockedAsync(Guid proofId, Guid orderId)
    {
        await _orders.LockForUpdateAsync(orderId);

        var proof = await _context.Set<OrderPaymentProof>().Include(p => p.Order).FirstOrDefaultAsync(p => p.Id == proofId);
        if (proof == null)
            return (null, Result<PaymentProofDto>.Fail("Чек не найден", ErrorType.NotFound));
        if (proof.Status != PaymentProofStatus.Pending)
            return (null, Result<PaymentProofDto>.Fail("Этот чек уже проверен", ErrorType.Conflict));
        return (proof, null);
    }

    private async Task RefreshPendingFlagAsync(Order order, Guid exceptProofId)
    {
        order.HasPendingPaymentProof = await _context.Set<OrderPaymentProof>()
            .AnyAsync(p => p.OrderId == order.Id && p.Id != exceptProofId && p.Status == PaymentProofStatus.Pending);
    }

    public async Task<Result<PaymentProofDto>> ApproveAsync(Guid proofId, decimal? amount, string reviewer)
    {
        var orderId = await ProofOrderIdAsync(proofId);
        if (orderId == null)
            return Result<PaymentProofDto>.Fail("Чек не найден", ErrorType.NotFound);

        return await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var (proof, error) = await LoadPendingLockedAsync(proofId, orderId.Value);
            if (proof == null)
                return error!;

            var order = proof.Order;
            if (order.Status == OrderStatus.Cancelled)
                return Result<PaymentProofDto>.Fail("Заказ отменён — принять оплату нельзя, отклоните чек", ErrorType.Validation);

            var accepted = Round2(amount ?? proof.Amount);
            if (accepted < 0.01m)
                return Result<PaymentProofDto>.Fail("Сумма должна быть больше нуля", ErrorType.Validation);

            var remaining = OrderService.ComputePayable(order) - order.PaidAmount;
            if (remaining <= 0)
                return Result<PaymentProofDto>.Fail("Заказ уже полностью оплачен — отклоните чек", ErrorType.Validation);
            if (accepted > remaining)
                return Result<PaymentProofDto>.Fail($"Сумма больше, чем осталось оплатить ({Money(remaining)})", ErrorType.Validation);

            proof.Status = PaymentProofStatus.Approved;
            proof.ApprovedAmount = accepted;
            proof.ReviewedAt = DateTime.UtcNow;
            proof.ReviewedBy = reviewer;

            order.PaidAmount += accepted;
            OrderService.RecalcPaymentStatus(order);
            order.UpdatedAt = DateTime.UtcNow;
            await RefreshPendingFlagAsync(order, proof.Id);
            await _context.SaveChangesAsync();

            await _activity.LogAsync(order.Id, $"{reviewer}: чек принят, зачислено {Money(accepted)} (всего оплачено {Money(order.PaidAmount)})", byClient: false);
            return Result<PaymentProofDto>.Ok(ToDto(proof));
        });
    }

    public async Task<Result<PaymentProofDto>> RejectAsync(Guid proofId, string reason, string reviewer)
    {
        reason = reason?.Trim() ?? string.Empty;
        if (reason.Length == 0)
            return Result<PaymentProofDto>.Fail("Укажите причину — клиент её увидит", ErrorType.Validation);
        if (reason.Length > 300) reason = reason[..300];

        var orderId = await ProofOrderIdAsync(proofId);
        if (orderId == null)
            return Result<PaymentProofDto>.Fail("Чек не найден", ErrorType.NotFound);

        return await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var (proof, error) = await LoadPendingLockedAsync(proofId, orderId.Value);
            if (proof == null)
                return error!;

            proof.Status = PaymentProofStatus.Rejected;
            proof.RejectReason = reason;
            proof.ReviewedAt = DateTime.UtcNow;
            proof.ReviewedBy = reviewer;
            proof.Order.UpdatedAt = DateTime.UtcNow;
            await RefreshPendingFlagAsync(proof.Order, proof.Id);
            await _context.SaveChangesAsync();

            await _activity.LogAsync(proof.OrderId, $"{reviewer}: чек на {Money(proof.Amount)} отклонён — {reason}", byClient: false);
            return Result<PaymentProofDto>.Ok(ToDto(proof));
        });
    }
}
