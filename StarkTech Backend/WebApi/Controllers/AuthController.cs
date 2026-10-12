using Application.DTOs.Auth;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

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

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    => HandleResult(await _authService.RegisterAsync(dto));

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var result = await _authService.LoginAsync(dto);
        return result.IsSuccess ? Ok(result.Data) : HandleResult(result);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(Result<string>.Fail("User ID not found in token", ErrorType.Unauthorized));

        return HandleResult(await _authService.ChangePasswordAsync(userId, dto));
    }

    [HttpPost("send-reset-code")]
    public async Task<IActionResult> SendResetCode([FromBody] SendEmailDto dto)
        => HandleResult(await _authService.SendPasswordResetEmailAsync(dto));

    [HttpPost("verify-reset-code")]
    public async Task<IActionResult> VerifyCode([FromBody] VerifyCodeDto dto)
        => HandleResult(await _authService.VerifyCodeAsync(dto));

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        => HandleResult(await _authService.ResetPasswordAsync(dto));

    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    [HttpPost("assign-role")]
    public async Task<IActionResult> AssignRole([FromBody] AssignRoleDto dto)
        => HandleResult(await _authService.AssignRoleAsync(dto));

    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    [HttpPost("remove-role")]
    public async Task<IActionResult> RemoveRole([FromBody] AssignRoleDto dto)
        => HandleResult(await _authService.RemoveRoleAsync(dto));
}
