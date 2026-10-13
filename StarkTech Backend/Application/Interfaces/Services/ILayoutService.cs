using Application.DTOs.Layout;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

/// <summary>Согласование макета заказа с клиентом.</summary>
public interface ILayoutService
{
    /// <summary>Макеты заказа, новые сверху. ownerId = null — сотрудник (любой заказ), иначе только заказ этого клиента.</summary>
    Task<Result<List<LayoutDto>>> GetByOrderAsync(Guid orderId, Guid? ownerId);

    /// <summary>Сотрудник отправляет макет: заказ переходит в «Согласование макета».</summary>
    Task<Result<LayoutDto>> UploadAsync(Guid orderId, IFormFile? file, string? note, string uploadedBy);

    Task<Result<LayoutDto>> ApproveAsync(Guid orderId, Guid layoutId, Guid ownerId);
    Task<Result<LayoutDto>> RequestChangesAsync(Guid orderId, Guid layoutId, Guid ownerId, string? comment);
}
