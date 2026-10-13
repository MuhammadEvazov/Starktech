using Application.DTOs.Product;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/products")]
public class ProductController : BaseController
{
    private readonly IProductService _productService;

    public ProductController(IProductService productService)
    {
        _productService = productService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetProductFilterDto filter)
    {
        // Публичный каталог никогда не отдаёт удалённые товары, что бы ни пришло в запросе.
        filter.Deleted = false;
        // Скрытые (IsActive = false) товары видят только сотрудники с доступом к товарам;
        // покупателю — только активные, даже если он не передал isActive или передал false.
        if (!await CanSeeHiddenProductsAsync())
            filter.IsActive = true;
        var result = await _productService.GetAllAsync(filter);
        return HandleResult(result);
    }

    private async Task<bool> CanSeeHiddenProductsAsync()
        => await HasPermissionAsync(UserPermissions.ProductsView) || await HasPermissionAsync(UserPermissions.ProductsEdit);

    // GET /api/products/deleted — корзина удалённых товаров
    [HttpGet("deleted")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsDelete)]
    public async Task<IActionResult> GetDeleted([FromQuery] GetProductFilterDto filter)
    {
        filter.Deleted = true;
        var result = await _productService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpPost("{id}/restore")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsDelete)]
    public async Task<IActionResult> Restore(Guid id)
    {
        var result = await _productService.RestoreAsync(id);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _productService.GetByIdAsync(id);
        if (result.IsSuccess && result.Data is { IsActive: false } && !await CanSeeHiddenProductsAsync())
            return NotFound(new[] { "Product not found" });
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Create(CreateProductDto dto)
    {
        var result = await _productService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Update(Guid id, UpdateProductDto dto)
    {
        var result = await _productService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _productService.DeleteAsync(id);
        return HandleResult(result);
    }

    [HttpPost("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var result = await _productService.UploadImageAsync(id, file);
        return HandleResult(result);
    }

    [HttpDelete("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        var result = await _productService.DeleteImageAsync(id);
        return HandleResult(result);
    }
}
