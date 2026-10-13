
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

    /// <summary>
    /// Код сброса пароля. Data = null, если аккаунта с таким email нет — вызывающий
    /// не должен раскрывать это клиенту (одинаковый ответ в обоих случаях).
    /// </summary>
    Task<Result<string?>> GenerateResetCodeAsync(string email);

    /// <summary>Проверка кода; при успехе Data — одноразовый токен сброса пароля.</summary>
    Task<Result<string>> VerifyResetCodeAsync(string email, string code);
    Task<Result<string>> ResetPasswordAsync(string email, string resetToken, string newPassword);

    // Управление ролями (callerId — кто меняет: себе менять нельзя, Admin выдаёт только SuperAdmin)
    Task<Result<string>> AssignRoleAsync(string callerId, string userId, string roleName);
    Task<Result<string>> RemoveRoleAsync(string callerId, string userId, string roleName);

    // Вспомогательные
    Task<Result<string>> GetUserEmailAsync(string userId);
}
