using Application.DTOs.PortfolioItem;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/portfolio-items")]
public class PortfolioItemController : BaseController
{
    private readonly IPortfolioItemService _portfolioItemService;

    public PortfolioItemController(IPortfolioItemService portfolioItemService)
    {
        _portfolioItemService = portfolioItemService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetPortfolioItemFilterDto filter)
    {
        var result = await _portfolioItemService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _portfolioItemService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PortfolioManage)]
    public async Task<IActionResult> Create(CreatePortfolioItemDto dto)
    {
        var result = await _portfolioItemService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PortfolioManage)]
    public async Task<IActionResult> Update(Guid id, UpdatePortfolioItemDto dto)
    {
        var result = await _portfolioItemService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PortfolioManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _portfolioItemService.DeleteAsync(id);
        return HandleResult(result);
    }

    [HttpPost("upload")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PortfolioManage)]
    public async Task<IActionResult> CreateWithImage([FromForm] CreatePortfolioItemWithImageDto dto)
    {
        var result = await _portfolioItemService.CreateWithImageAsync(dto);
        return HandleResult(result);
    }

    [HttpPost("{id}/image")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PortfolioManage)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var result = await _portfolioItemService.UploadImageAsync(id, file);
        return HandleResult(result);
    }
}
