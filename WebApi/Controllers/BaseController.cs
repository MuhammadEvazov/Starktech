using Application.Interfaces.Repositories;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Authorization;
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
            ErrorType.Forbidden => Forbid(),
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

        return profile?.Id;
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
