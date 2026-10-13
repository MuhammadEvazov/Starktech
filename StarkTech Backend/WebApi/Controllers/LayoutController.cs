using Application.DTOs.Layout;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

/// <summary>
/// Согласование макета: сотрудник отправляет макет, клиент (владелец заказа) одобряет или просит правки.
/// </summary>
[Authorize]
public class LayoutController : BaseController
{
    private readonly ILayoutService _layouts;

    public LayoutController(ILayoutService layouts)
    {
        _layouts = layouts;
    }

    private async Task<string> StaffNameAsync()
    {
        var appUserId = GetCurrentUserId();
        var users = HttpContext.RequestServices.GetRequiredService<IUserRepository>();
        var profile = appUserId == null ? null : await users.GetByIdAsync(appUserId);
        return profile?.FullName ?? "Сотрудник";
    }

    // ── Сотрудник ──
    [HttpGet("api/orders/{orderId:guid}/layouts")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> List(Guid orderId)
        => HandleResult(await _layouts.GetByOrderAsync(orderId, null));

    [HttpPost("api/orders/{orderId:guid}/layouts")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid orderId, IFormFile? file, [FromForm] string? note)
        => HandleResult(await _layouts.UploadAsync(orderId, file, note, await StaffNameAsync()));

    // ── Клиент: макеты своего заказа ──
    [HttpGet("api/orders/my/{orderId:guid}/layouts")]
    public async Task<IActionResult> Mine(Guid orderId)
    {
        var profileId = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        return HandleResult(await _layouts.GetByOrderAsync(orderId, profileId));
    }

    [HttpPost("api/orders/my/{orderId:guid}/layouts/{layoutId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid orderId, Guid layoutId)
    {
        var profileId = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        return HandleResult(await _layouts.ApproveAsync(orderId, layoutId, profileId));
    }

    [HttpPost("api/orders/my/{orderId:guid}/layouts/{layoutId:guid}/request-changes")]
    public async Task<IActionResult> RequestChanges(Guid orderId, Guid layoutId, RequestLayoutChangesDto dto)
    {
        var profileId = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        return HandleResult(await _layouts.RequestChangesAsync(orderId, layoutId, profileId, dto.Comment));
    }
}
