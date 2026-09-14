using Application.DTOs.OrderItemPhoto;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers;

[ApiController]
[Route("api")]
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
        var result = await _photoService.GetByOrderItemIdAsync(orderItemId);
        return HandleResult(result);
    }

    [HttpPost("order-items/{orderItemId}/photos")]
    public async Task<IActionResult> Upload(Guid orderItemId, IFormFile file)
    {
        var result = await _photoService.UploadAsync(orderItemId, file);
        return HandleResult(result);
    }

    [HttpPost("order-item-photos/{photoId}/edited-preview")]
    public async Task<IActionResult> UploadEditedPreview(Guid photoId, IFormFile file)
    {
        var result = await _photoService.UploadEditedPreviewAsync(photoId, file);
        return HandleResult(result);
    }

    [HttpPut("order-item-photos/{photoId}/crop")]
    public async Task<IActionResult> UpdateCrop(Guid photoId, UpdateCropDataDto dto)
    {
        var result = await _photoService.UpdateCropDataAsync(photoId, dto);
        return HandleResult(result);
    }

    [HttpDelete("order-item-photos/{photoId}")]
    public async Task<IActionResult> Delete(Guid photoId)
    {
        var result = await _photoService.DeleteAsync(photoId);
        return HandleResult(result);
    }
}
