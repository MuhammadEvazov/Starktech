using Application.DTOs.Auth;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IIdentityService
{
    // Аутентификация
    Task<(bool Success, string UserId, List<string> Errors)> RegisterAsync(RegisterDto dto);
    Task<(bool Success, string Token, DateTime Expiration, string Email, string UserId, List<string> Errors)> LoginAsync(LoginDto dto);

    // Управление паролем
    Task<Result<string>> ChangePasswordAsync(string userId, string oldPassword, string newPassword);
    Task<Result<string>> GenerateResetCodeAsync(string email);
    Task<Result<bool>> VerifyResetCodeAsync(string email, string code);
    Task<Result<string>> ResetPasswordAsync(string email, string newPassword);

    // Управление ролями
    Task<Result<string>> AssignRoleAsync(string userId, string roleName);
    Task<Result<string>> RemoveRoleAsync(string userId, string roleName);

    // Вспомогательные
    Task<Result<string>> GetUserEmailAsync(string userId);
}

