using Application.DTOs.PromoCode;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/promo-codes")]
public class PromoCodeController : BaseController
{
    private readonly IPromoCodeService _promoCodeService;

    public PromoCodeController(IPromoCodeService promoCodeService)
    {
        _promoCodeService = promoCodeService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetPromoCodeFilterDto filter)
    {
        var result = await _promoCodeService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _promoCodeService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
    public async Task<IActionResult> Create(CreatePromoCodeDto dto)
    {
        var result = await _promoCodeService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
    public async Task<IActionResult> Update(Guid id, UpdatePromoCodeDto dto)
    {
        var result = await _promoCodeService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _promoCodeService.DeleteAsync(id);
        return HandleResult(result);
    }
}
