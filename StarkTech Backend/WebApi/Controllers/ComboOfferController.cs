using Application.DTOs.ComboOffer;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/combo-offers")]
public class ComboOfferController : BaseController
{
    private readonly IComboOfferService _comboOfferService;

    public ComboOfferController(IComboOfferService comboOfferService)
    {
        _comboOfferService = comboOfferService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetComboOfferFilterDto filter)
    {
        var result = await _comboOfferService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _comboOfferService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ComboOffersManage)]
    public async Task<IActionResult> Create(CreateComboOfferDto dto)
    {
        var result = await _comboOfferService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ComboOffersManage)]
    public async Task<IActionResult> Update(Guid id, UpdateComboOfferDto dto)
    {
        var result = await _comboOfferService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ComboOffersManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _comboOfferService.DeleteAsync(id);
        return HandleResult(result);
    }
}
