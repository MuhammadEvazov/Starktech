using Application.DTOs.PromoCode;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StarkTech.Domain.Constants;
using WebApi.Authorization;
using WebApi.MiddleWares;

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

    // Полный список и карточка промокода (лимиты, счётчики) — только для сотрудников с правом.
    [HttpGet]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
    public async Task<IActionResult> GetAll([FromQuery] GetPromoCodeFilterDto filter)
    {
        var result = await _promoCodeService.GetAllAsync(filter);
        return HandleResult(result);
    }

    /// <summary>
    /// Проверка промокода клиентом при оформлении: { id, code, discountType, discountValue }
    /// или 400 с русским текстом (нет/выключен, ещё не начал, истёк, исчерпан, вы уже использовали).
    /// </summary>
    [HttpGet("validate")]
    [Authorize]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> Validate([FromQuery] string? code)
    {
        var profileId = await GetCurrentProfileIdAsync();
        var result = await _promoCodeService.ValidateAsync(code ?? string.Empty, profileId);
        return HandleResult(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
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

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
    public async Task<IActionResult> Update(Guid id, UpdatePromoCodeDto dto)
    {
        var result = await _promoCodeService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.PromoCodesManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _promoCodeService.DeleteAsync(id);
        return HandleResult(result);
    }
}
