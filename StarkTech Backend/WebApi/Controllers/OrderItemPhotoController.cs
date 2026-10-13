using Application.DTOs.OrderItemPhoto;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;

namespace WebApi.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class OrderItemPhotoController : BaseController
{
    private readonly IOrderItemPhotoService _photoService;

    public OrderItemPhotoController(IOrderItemPhotoService photoService)
    {
        _photoService = photoService;
    }

    [HttpGet("order-items/{orderItemId}/photos")]
    public async Task<IActionResult> GetByOrderItem(Guid orderItemId)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersView);
        var result = await _photoService.GetByOrderItemIdAsync(orderItemId, scope);
        return HandleResult(result);
    }

    [HttpPost("order-items/{orderItemId}/photos")]
    public async Task<IActionResult> Upload(Guid orderItemId, IFormFile file, [FromForm] string? copies)
    {
        // Фото для печати присылает только сам клиент — владелец заказа. Сотрудники,
        // даже с правом orders.edit, свои фото к чужому заказу добавить не могут.
        var owner = await GetCurrentProfileIdAsync() ?? Guid.Empty;

        // Поле copies необязательное: пусто — 1 копия; мусор (не число) — 0, отклонит валидация сервиса
        var copiesCount = 1;
        if (!string.IsNullOrWhiteSpace(copies))
            copiesCount = int.TryParse(copies.Trim(), out var parsed) ? parsed : 0;

        var result = await _photoService.UploadAsync(orderItemId, file, copiesCount, owner);
        return HandleResult(result);
    }

    [HttpPost("order-item-photos/{photoId}/edited-preview")]
    public async Task<IActionResult> UploadEditedPreview(Guid photoId, IFormFile file)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersEdit);
        var result = await _photoService.UploadEditedPreviewAsync(photoId, file, scope);
        return HandleResult(result);
    }

    [HttpPut("order-item-photos/{photoId}/crop")]
    public async Task<IActionResult> UpdateCrop(Guid photoId, UpdateCropDataDto dto)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersEdit);
        var result = await _photoService.UpdateCropDataAsync(photoId, dto, scope);
        return HandleResult(result);
    }

    // Сколько стикеров печатать с фото — доступ как у обновления кадра
    [HttpPut("order-item-photos/{photoId}/copies")]
    public async Task<IActionResult> UpdateCopies(Guid photoId, UpdateCopiesDto dto)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersEdit);
        var result = await _photoService.UpdateCopiesAsync(photoId, dto, scope);
        return HandleResult(result);
    }

    [HttpDelete("order-item-photos/{photoId}")]
    public async Task<IActionResult> Delete(Guid photoId)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersEdit);
        var result = await _photoService.DeleteAsync(photoId, scope);
        return HandleResult(result);
    }
}
