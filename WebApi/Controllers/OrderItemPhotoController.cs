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
    public async Task<IActionResult> Upload(Guid orderItemId, IFormFile file)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersEdit);
        var result = await _photoService.UploadAsync(orderItemId, file, scope);
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

    [HttpDelete("order-item-photos/{photoId}")]
    public async Task<IActionResult> Delete(Guid photoId)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersEdit);
        var result = await _photoService.DeleteAsync(photoId, scope);
        return HandleResult(result);
    }
}
