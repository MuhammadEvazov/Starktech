using Application.DTOs.Category;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoryController : BaseController
{
    private readonly ICategoryService _categoryService;

    public CategoryController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetCategoryFilterDto filter)
    {
        var result = await _categoryService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _categoryService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Create(CreateCategoryDto dto)
    {
        var result = await _categoryService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Update(Guid id, UpdateCategoryDto dto)
    {
        var result = await _categoryService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _categoryService.DeleteAsync(id);
        return HandleResult(result);
    }

    [HttpPost("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var result = await _categoryService.UploadImageAsync(id, file);
        return HandleResult(result);
    }

    [HttpDelete("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        var result = await _categoryService.DeleteImageAsync(id);
        return HandleResult(result);
    }
}
