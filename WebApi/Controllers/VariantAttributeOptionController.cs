using Application.DTOs.VariantAttributeOption;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/variant-attribute-options")]
public class VariantAttributeOptionController : BaseController
{
    private readonly IVariantAttributeOptionService _optionService;

    public VariantAttributeOptionController(IVariantAttributeOptionService optionService)
    {
        _optionService = optionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetVariantAttributeOptionFilterDto filter)
    {
        var result = await _optionService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _optionService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpGet("category/{categoryId}/grouped")]
    public async Task<IActionResult> GetGroupedByCategory(Guid categoryId)
    {
        var result = await _optionService.GetGroupedByCategoryAsync(categoryId);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Create(CreateVariantAttributeOptionDto dto)
    {
        var result = await _optionService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Update(Guid id, UpdateVariantAttributeOptionDto dto)
    {
        var result = await _optionService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ProductsEdit)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _optionService.DeleteAsync(id);
        return HandleResult(result);
    }
}
