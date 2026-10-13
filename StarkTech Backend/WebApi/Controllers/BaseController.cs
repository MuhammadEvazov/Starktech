using Application.Interfaces.Repositories;
using Application.Result;
using Application.Results;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
public abstract class BaseController : ControllerBase
{
    protected IActionResult HandleResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(result);

        return result.ErrorType switch
        {
            ErrorType.NotFound => NotFound(result.Errors),
            ErrorType.Validation => BadRequest(result.Errors),
            ErrorType.NoChange => BadRequest(result.Errors),
            ErrorType.Conflict => Conflict(result.Errors),
            ErrorType.Unauthorized => Unauthorized(result.Errors),
            ErrorType.Forbidden => StatusCode(403, result.Errors),
            _ => StatusCode(500, result.Errors)
        };
    }

    protected string? GetCurrentUserId()
        => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    protected async Task<bool> HasPermissionAsync(string permission)
    {
        if (User.Identity?.IsAuthenticated != true)
            return false;

        var authorizationService = HttpContext.RequestServices.GetRequiredService<IAuthorizationService>();
        var result = await authorizationService.AuthorizeAsync(User, PermissionPolicy.Prefix + permission);

        return result.Succeeded;
    }

    protected async Task<Guid?> GetCurrentProfileIdAsync()
    {
        var appUserId = GetCurrentUserId();
        if (string.IsNullOrWhiteSpace(appUserId))
            return null;

        var userRepository = HttpContext.RequestServices.GetRequiredService<IUserRepository>();
        var profile = await userRepository.GetByIdAsync(appUserId);

        if (profile == null)
        {
            // Учётная запись без профиля (старый сбой регистрации): без профиля заказ сохранится
            // без владельца, и клиент не сможет открыть его и загрузить фото. Создаём профиль сразу.
            // Профиль создаём только для реально существующего аккаунта Identity (не по одному claim'у
            // из токена), а email берём из самого аккаунта.
            var userManager = HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var appUser = await userManager.FindByIdAsync(appUserId);
            var email = appUser?.Email;
            if (appUser == null || string.IsNullOrWhiteSpace(email))
                return null;

            profile = Domain.Entities.User.Create(appUserId, email);
            await userRepository.AddAsync(profile);
        }

        return profile.Id;
    }

    // null = unrestricted (caller holds the admin permission); otherwise the caller's own profile id,
    // or Guid.Empty when the caller has no profile, which matches no records.
    protected async Task<Guid?> GetOwnerScopeAsync(string adminPermission)
    {
        if (await HasPermissionAsync(adminPermission))
            return null;

        return await GetCurrentProfileIdAsync() ?? Guid.Empty;
    }
}
