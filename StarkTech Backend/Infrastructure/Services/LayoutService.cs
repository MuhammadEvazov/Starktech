using Application.DTOs.Layout;
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

/// <summary>
/// Согласование макета: сотрудник загружает макет, клиент одобряет его или просит правки.
/// Смена статуса заказа — под блокировкой строки заказа.
/// </summary>
public class LayoutService : ILayoutService
{
    private const string LayoutFolder = "layouts";
    private const int MaxTextLength = 500;

    private const string NotAllowedForUpload =
        "Макет можно отправить только для подтверждённого заказа или заказа на согласовании макета";

    private readonly AppDbContext _context;
    private readonly IFileService _files;
    private readonly IOrderActivityService _activity;
    private readonly IOrderRepository _orderRepository;
    private readonly IUnitOfWork _unitOfWork;

    public LayoutService(
        AppDbContext context,
        IFileService files,
        IOrderActivityService activity,
        IOrderRepository orderRepository,
        IUnitOfWork unitOfWork)
    {
        _context = context;
        _files = files;
        _activity = activity;
        _orderRepository = orderRepository;
        _unitOfWork = unitOfWork;
    }

    private static string? Clean(string? value)
    {
        var v = value?.Trim();
        return string.IsNullOrEmpty(v) ? null : v;
    }

    private static bool CanSendLayout(OrderStatus status)
        => status is OrderStatus.Confirmed or OrderStatus.AwaitingLayoutApproval;

    private static LayoutDto ToDto(OrderLayout l) => new()
    {
        Id = l.Id,
        OrderId = l.OrderId,
        ImageUrl = l.ImageUrl,
        Note = l.Note,
        Status = l.Status,
        CustomerComment = l.CustomerComment,
        CreatedAt = l.CreatedAt,
        RespondedAt = l.RespondedAt,
        UploadedBy = l.UploadedBy
    };

    public async Task<Result<List<LayoutDto>>> GetByOrderAsync(Guid orderId, Guid? ownerId)
    {
        var exists = await _context.Orders.AnyAsync(o => o.Id == orderId && (ownerId == null || o.UserId == ownerId));
        if (!exists)
            return Result<List<LayoutDto>>.Fail("Order not found", ErrorType.NotFound);

        var layouts = await _context.Set<OrderLayout>().AsNoTracking()
            .Where(l => l.OrderId == orderId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return Result<List<LayoutDto>>.Ok(layouts.Select(ToDto).ToList());
    }

    public async Task<Result<LayoutDto>> UploadAsync(Guid orderId, IFormFile? file, string? note, string uploadedBy)
    {
        note = Clean(note);
        if (note?.Length > MaxTextLength)
            return Result<LayoutDto>.Fail($"Комментарий к макету — не длиннее {MaxTextLength} символов", ErrorType.Validation);

        var fileError = _files.ValidateImage(file);
        if (fileError != null)
            return Result<LayoutDto>.Fail(fileError, ErrorType.Validation);

        // Быстрая проверка до загрузки файла, чтобы не сохранять лишнее; окончательная — под блокировкой.
        var order = await _context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null)
            return Result<LayoutDto>.Fail("Order not found", ErrorType.NotFound);
        if (!CanSendLayout(order.Status))
            return Result<LayoutDto>.Fail(NotAllowedForUpload, ErrorType.Validation);

        var url = await _files.UploadAsync(file!, LayoutFolder);
        if (url == null)
            return Result<LayoutDto>.Fail("Не удалось сохранить макет", ErrorType.Validation);

        Result<LayoutDto> result;
        try
        {
            result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _orderRepository.LockForUpdateAsync(orderId);

                var locked = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
                if (locked == null)
                    return Result<LayoutDto>.Fail("Order not found", ErrorType.NotFound);
                if (!CanSendLayout(locked.Status))
                    return Result<LayoutDto>.Fail(NotAllowedForUpload, ErrorType.Validation);

                var layout = new OrderLayout
                {
                    OrderId = orderId,
                    ImageUrl = url,
                    Note = note,
                    Status = LayoutStatus.Pending,
                    UploadedBy = string.IsNullOrWhiteSpace(uploadedBy) ? "Сотрудник" : uploadedBy.Trim()
                };
                _context.Add(layout);

                locked.Status = OrderStatus.AwaitingLayoutApproval;
                locked.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _activity.LogAsync(orderId, "Отправлен макет на согласование", byClient: false);

                return Result<LayoutDto>.Ok(ToDto(layout));
            });
        }
        catch
        {
            // Запись не сохранилась — файл больше не нужен.
            await _files.DeleteAsync(url);
            throw;
        }

        if (!result.IsSuccess)
            await _files.DeleteAsync(url);

        return result;
    }

    public Task<Result<LayoutDto>> ApproveAsync(Guid orderId, Guid layoutId, Guid ownerId)
    {
        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var (order, layout, error) = await LoadForResponseAsync(orderId, layoutId, ownerId);
            if (error != null)
                return error;

            var now = DateTime.UtcNow;
            layout!.Status = LayoutStatus.Approved;
            layout.RespondedAt = now;

            // Все отправленные макеты согласованы — заказ уходит в производство.
            var hasOtherPending = await _context.Set<OrderLayout>()
                .AnyAsync(l => l.OrderId == orderId && l.Id != layoutId && l.Status == LayoutStatus.Pending);
            if (!hasOtherPending && order!.Status == OrderStatus.AwaitingLayoutApproval)
                order.Status = OrderStatus.InProduction;
            order!.UpdatedAt = now;

            await _context.SaveChangesAsync();

            await _activity.LogAsync(orderId, "Клиент одобрил макет", byClient: true);

            return Result<LayoutDto>.Ok(ToDto(layout));
        });
    }

    public Task<Result<LayoutDto>> RequestChangesAsync(Guid orderId, Guid layoutId, Guid ownerId, string? comment)
    {
        comment = Clean(comment);
        if (comment == null)
            return Task.FromResult(Result<LayoutDto>.Fail("Опишите, что нужно изменить в макете", ErrorType.Validation));
        if (comment.Length > MaxTextLength)
            return Task.FromResult(Result<LayoutDto>.Fail($"Комментарий — не длиннее {MaxTextLength} символов", ErrorType.Validation));

        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var (order, layout, error) = await LoadForResponseAsync(orderId, layoutId, ownerId);
            if (error != null)
                return error;

            var now = DateTime.UtcNow;
            layout!.Status = LayoutStatus.ChangesRequested;
            layout.CustomerComment = comment;
            layout.RespondedAt = now;
            order!.UpdatedAt = now; // заказ остаётся в «Согласовании макета»

            await _context.SaveChangesAsync();

            await _activity.LogAsync(orderId, $"Клиент просит правки макета: {comment}", byClient: true);

            return Result<LayoutDto>.Ok(ToDto(layout));
        });
    }

    // Вызывается внутри транзакции: блокирует заказ, проверяет владельца и что макет ждёт ответа.
    private async Task<(Order? Order, OrderLayout? Layout, Result<LayoutDto>? Error)> LoadForResponseAsync(
        Guid orderId, Guid layoutId, Guid ownerId)
    {
        await _orderRepository.LockForUpdateAsync(orderId);

        var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == ownerId);
        if (order == null)
            return (null, null, Result<LayoutDto>.Fail("Order not found", ErrorType.NotFound));

        var layout = await _context.Set<OrderLayout>().FirstOrDefaultAsync(l => l.Id == layoutId && l.OrderId == orderId);
        if (layout == null)
            return (null, null, Result<LayoutDto>.Fail("Макет не найден", ErrorType.NotFound));

        if (layout.Status != LayoutStatus.Pending)
            return (null, null, Result<LayoutDto>.Fail("Вы уже ответили на этот макет", ErrorType.Validation));

        if (order.Status != OrderStatus.AwaitingLayoutApproval)
            return (null, null, Result<LayoutDto>.Fail("Заказ уже не ждёт согласования макета", ErrorType.Validation));

        return (order, layout, null);
    }
}
