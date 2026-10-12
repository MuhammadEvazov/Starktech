using Application.DTOs.ProductMedia;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

/// <summary>Галерея товара и его вариантов: фото и видео.</summary>
[Route("api")]
public class ProductMediaController : BaseController
{
    // Видео до 50 МБ + запас на заголовки multipart.
    private const long MaxUploadBytes = 60 * 1024 * 1024;

    private readonly IProductMediaService _mediaService;

    public ProductMediaController(IProductMediaService mediaService)
    {
        _mediaService = mediaService;
    }

    // GET /api/products/{productId}/media — публично, для страницы товара
    [HttpGet("products/{productId:guid}/media")]
    public async Task<IActionResult> GetByProduct(Guid productId)
    {
        var result = await _mediaService.GetByProductAsync(productId);
        return HandleResult(result);
    }

    // POST /api/products/{productId}/media — один файл за запрос; variantId пусто = общая галерея
    [HttpPost("products/{productId:guid}/media")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<IActionResult> Upload(Guid productId, IFormFile file, [FromForm] Guid? variantId)
    {
        var result = await _mediaService.UploadAsync(productId, variantId, file);
        return HandleResult(result);
    }

    [HttpPut("products/{productId:guid}/media/order")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Reorder(Guid productId, ReorderProductMediaDto dto)
    {
        var result = await _mediaService.ReorderAsync(productId, dto.Ids);
        return HandleResult(result);
    }

    [HttpDelete("product-media/{id:guid}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _mediaService.DeleteAsync(id);
        return HandleResult(result);
    }
}
