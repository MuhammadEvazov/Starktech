using Application.DTOs.User;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/User")]
[Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersManage)]
public class UserController : BaseController
{
    private const string SuperAdminRole = "SuperAdmin";
    private const string AdminRole = "Admin";

    private readonly IUserService _userService;
    private readonly UserManager<AppUser> _userManager;
    private readonly ILogger<UserController> _logger;

    public UserController(IUserService userService, UserManager<AppUser> userManager, ILogger<UserController> logger)
    {
        _userService = userService;
        _userManager = userManager;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] GetUserFilterDto filter)
    {
        var result = await _userService.GetUsersAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _userService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost("{id}/roles")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    public async Task<IActionResult> AssignRole(string id, [FromBody] ChangeUserRoleDto dto)
    {
        var denied = await CheckRoleChangeAllowedAsync(id, dto.Role);
        if (denied != null)
            return HandleResult(denied);

        var result = await _userService.AssignRoleAsync(id, dto.Role);
        if (result.IsSuccess)
            await AfterRoleChangeAsync(id, dto.Role, "assigned");

        return HandleResult(result);
    }

    [HttpDelete("{id}/roles/{role}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    public async Task<IActionResult> RemoveRole(string id, string role)
    {
        var denied = await CheckRoleChangeAllowedAsync(id, role);
        if (denied != null)
            return HandleResult(denied);

        var result = await _userService.RemoveRoleAsync(id, role);
        if (result.IsSuccess)
            await AfterRoleChangeAsync(id, role, "removed");

        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        if (string.Equals(id, GetCurrentUserId(), StringComparison.Ordinal))
            return HandleResult(Result<bool>.Fail("Нельзя удалить собственный аккаунт отсюда.", ErrorType.Forbidden));

        var result = await _userService.DeleteAsync(id);
        if (result.IsSuccess)
            _logger.LogWarning("User {UserId} deleted by {CallerId}", id, GetCurrentUserId());

        return HandleResult(result);
    }

    // Себе роли менять нельзя; роль Admin выдаёт и снимает только SuperAdmin; SuperAdmin через API не трогаем.
    private async Task<Result<bool>?> CheckRoleChangeAllowedAsync(string targetUserId, string role)
    {
        var callerId = GetCurrentUserId();
        if (string.IsNullOrEmpty(callerId))
            return Result<bool>.Fail("Нужно войти в аккаунт.", ErrorType.Unauthorized);

        if (string.Equals(callerId, targetUserId, StringComparison.Ordinal))
            return Result<bool>.Fail("Нельзя менять роли самому себе.", ErrorType.Forbidden);

        if (string.Equals(role?.Trim(), AdminRole, StringComparison.OrdinalIgnoreCase) && !User.IsInRole(SuperAdminRole))
            return Result<bool>.Fail("Роль администратора может выдавать и снимать только главный администратор.", ErrorType.Forbidden);

        var target = await _userManager.FindByIdAsync(targetUserId);
        if (target != null && await _userManager.IsInRoleAsync(target, SuperAdminRole))
            return Result<bool>.Fail("Роли главного администратора через API не меняются.", ErrorType.Forbidden);

        return null;
    }

    // Новый штамп безопасности отзывает токены пользователя со старым набором ролей.
    private async Task AfterRoleChangeAsync(string targetUserId, string role, string action)
    {
        var target = await _userManager.FindByIdAsync(targetUserId);
        if (target != null)
            await _userManager.UpdateSecurityStampAsync(target);

        _logger.LogWarning("Role {Role} {Action} for user {UserId} by {CallerId}",
            role, action, targetUserId, GetCurrentUserId());
    }
}
