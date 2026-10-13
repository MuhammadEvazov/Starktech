using Application.DTOs.Auth;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IAuthService
{
    Task<Result<LoginResponseDto>> LoginAsync(LoginDto dto);
    Task<Result<RegisterResponseDto>> RegisterAsync(RegisterDto dto);
    Task<Result<string>> ChangePasswordAsync(string userId, ChangePasswordDto dto);
    Task<Result<string>> SendPasswordResetEmailAsync(SendEmailDto dto);
    Task<Result<VerifyCodeResponseDto>> VerifyCodeAsync(VerifyCodeDto dto);
    Task<Result<string>> ResetPasswordAsync(ResetPasswordDto dto);
    Task<Result<string>> AssignRoleAsync(string callerId, AssignRoleDto dto);
    Task<Result<string>> RemoveRoleAsync(string callerId, AssignRoleDto dto);
}
