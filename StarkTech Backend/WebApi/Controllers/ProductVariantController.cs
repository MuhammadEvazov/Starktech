using Application.DTOs.ProductVariant;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/product-variants")]
public class ProductVariantController : BaseController
{
    private readonly IProductVariantService _variantService;

    public ProductVariantController(IProductVariantService variantService)
    {
        _variantService = variantService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetProductVariantFilterDto filter)
    {
        // Сайт и админка видят только живые варианты, что бы ни пришло в запросе.
        filter.Deleted = false;
        var result = await _variantService.GetAllAsync(filter);
        return HandleResult(result);
    }

    // GET /api/product-variants/deleted?productId=… — удалённые варианты товара
    [HttpGet("deleted")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> GetDeleted([FromQuery] GetProductVariantFilterDto filter)
    {
        filter.Deleted = true;
        var result = await _variantService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpPost("{id}/restore")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Restore(Guid id)
    {
        var result = await _variantService.RestoreAsync(id);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _variantService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Create(CreateProductVariantDto dto)
    {
        var result = await _variantService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Update(Guid id, UpdateProductVariantDto dto)
    {
        var result = await _variantService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _variantService.DeleteAsync(id);
        return HandleResult(result);
    }

    [HttpPost("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var result = await _variantService.UploadImageAsync(id, file);
        return HandleResult(result);
    }

    [HttpDelete("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        var result = await _variantService.DeleteImageAsync(id);
        return HandleResult(result);
    }
}
