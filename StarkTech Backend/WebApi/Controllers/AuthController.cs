using Application.DTOs.Auth;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StarkTech.Domain.Constants;
using WebApi.Authorization;
using WebApi.MiddleWares;

namespace WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : BaseController
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    // Анонимные эндпоинты — под строгим лимитом запросов с одного IP (политика "auth" в Program.cs).
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    => HandleResult(await _authService.RegisterAsync(dto));

    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var result = await _authService.LoginAsync(dto);
        return result.IsSuccess ? Ok(result.Data) : HandleResult(result);
    }

    [Authorize]
    [HttpPost("change-password")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(Result<string>.Fail("Нужно войти в аккаунт.", ErrorType.Unauthorized));

        return HandleResult(await _authService.ChangePasswordAsync(userId, dto));
    }

    [HttpPost("send-reset-code")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> SendResetCode([FromBody] SendEmailDto dto)
        => HandleResult(await _authService.SendPasswordResetEmailAsync(dto));

    /// <summary>При успехе data = { resetToken } — его нужно передать в reset-password.</summary>
    [HttpPost("verify-reset-code")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> VerifyCode([FromBody] VerifyCodeDto dto)
        => HandleResult(await _authService.VerifyCodeAsync(dto));

    [HttpPost("reset-password")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        => HandleResult(await _authService.ResetPasswordAsync(dto));

    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    [HttpPost("assign-role")]
    public async Task<IActionResult> AssignRole([FromBody] AssignRoleDto dto)
        => HandleResult(await _authService.AssignRoleAsync(GetCurrentUserId() ?? string.Empty, dto));

    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    [HttpPost("remove-role")]
    public async Task<IActionResult> RemoveRole([FromBody] AssignRoleDto dto)
        => HandleResult(await _authService.RemoveRoleAsync(GetCurrentUserId() ?? string.Empty, dto));
}
