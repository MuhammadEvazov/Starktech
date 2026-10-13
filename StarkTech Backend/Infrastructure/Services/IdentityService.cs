using System.Security.Cryptography;
using System.Text;
using Application.DTOs.Auth;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class IdentityService : IIdentityService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly ILogger<IdentityService> _logger;
    private readonly IJwtService _jwtservice;
    private readonly IDistributedCache _cache;
    private readonly IUserRepository _userRepository;

    private static readonly TimeSpan ResetCodeLifetime = TimeSpan.FromMinutes(10);
    // После проверки кода на ввод нового пароля даём столько же — дальше начинать заново.
    private static readonly TimeSpan ResetTokenLifetime = TimeSpan.FromMinutes(10);
    // Неверных вводов кода на одну выдачу: после этого код сгорает (перебор 6 цифр невозможен).
    private const int MaxResetCodeAttempts = 5;

    private const string InvalidCredentialsMessage = "Неверный email или пароль.";
    private const string InvalidCodeMessage = "Неверный или просроченный код.";
    private const string ResetSessionExpiredMessage = "Время на смену пароля истекло. Запросите код заново.";

    private const string SuperAdminRole = "SuperAdmin";
    private const string AdminRole = "Admin";

    // SuperAdmin is deliberately absent: it is granted only by DataSeed, never through the API.
    // "User" is the role RegisterAsync assigns; "Client" is the seeded UserRole.Client equivalent.
    private static readonly string[] AssignableRoles =
    {
        "User",
        "Client",
        AdminRole
    };

    private static string? NormalizeAssignableRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return null;

        return AssignableRoles.FirstOrDefault(x =>
            string.Equals(x, role.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public IdentityService(UserManager<AppUser> userManager,
                            RoleManager<IdentityRole> roleManager,
                            ILogger<IdentityService> logger,
                            IJwtService jwtservice,
                            IDistributedCache cache,
                            IUserRepository userRepository)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _logger = logger;
        _jwtservice = jwtservice;
        _cache = cache;
        _userRepository = userRepository;
    }

    private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string GetResetCodeCacheKey(string email) =>
        $"password-reset-code:{NormalizeEmail(email)}";

    private static string GetResetAttemptsCacheKey(string email) =>
        $"password-reset-attempts:{NormalizeEmail(email)}";

    private static string GetResetTokenCacheKey(string email) =>
        $"password-reset-token:{NormalizeEmail(email)}";

    // Сравнение за постоянное время — по времени ответа нельзя угадывать символы.
    private static bool SecureEquals(string? a, string? b)
    {
        if (a == null || b == null)
            return false;

        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
    }



    public async Task<(bool Success, string UserId, List<string> Errors)> RegisterAsync(RegisterDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return (false, string.Empty, new List<string> { "Укажите email." });
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return (false, string.Empty, new List<string> { "Укажите пароль." });
        }

        var user = new AppUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            PhoneNumber = dto.PhoneNumber
        };

        var result = await _userManager.CreateAsync(user, dto.Password);

        if (!result.Succeeded)
        {
            return (false, string.Empty, result.Errors.Select(e => e.Description).ToList());
        }

        if (!await _roleManager.RoleExistsAsync("User"))
        {
            await _roleManager.CreateAsync(new IdentityRole("User"));
        }

        var roleResult = await _userManager.AddToRoleAsync(user, "User");

        if (!roleResult.Succeeded)
        {
            return (false, string.Empty, roleResult.Errors.Select(e => e.Description).ToList());
        }

        var profile = Domain.Entities.User.Create(user.Id, dto.Email, dto.FullName);
        profile.PhoneNumber = dto.PhoneNumber;

        try
        {
            await _userRepository.AddAsync(profile);
        }
        catch (Exception ex)
        {
            // Без профиля аккаунт неработоспособен (заказы без владельца, фото не грузятся) —
            // откатываем вход, чтобы пользователь мог зарегистрироваться заново.
            _logger.LogError(ex, "Profile creation failed for {Email}, rolling back registration", dto.Email);
            await _userManager.DeleteAsync(user);
            return (false, string.Empty, new List<string> { "Не удалось завершить регистрацию. Попробуйте ещё раз." });
        }

        _logger.LogInformation("User registered: {Email}", dto.Email);

        return (true, user.Id, new List<string>());

    }



    public async Task<(bool Success, string Token, DateTime Expiration, string Email, string UserId, List<string> Errors)> LoginAsync(LoginDto dto)
    {
        static (bool, string, DateTime, string, string, List<string>) Fail(string message)
            => (false, string.Empty, default, string.Empty, string.Empty, new List<string> { message });

        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrEmpty(dto.Password))
            return Fail(InvalidCredentialsMessage);

        var user = await _userManager.FindByEmailAsync(dto.Email.Trim());

        if (user == null)
            return Fail(InvalidCredentialsMessage);

        // Блокировка после серии неудачных попыток (настройки Lockout в Program.cs).
        if (await _userManager.IsLockedOutAsync(user))
            return Fail(LockedOutMessage(user));

        var valid = await _userManager.CheckPasswordAsync(user, dto.Password);

        if (!valid)
        {
            await _userManager.AccessFailedAsync(user);

            if (await _userManager.IsLockedOutAsync(user))
            {
                _logger.LogWarning("User {UserId} locked out after failed login attempts", user.Id);
                return Fail(LockedOutMessage(user));
            }

            return Fail(InvalidCredentialsMessage);
        }

        if (await _userManager.GetAccessFailedCountAsync(user) > 0)
            await _userManager.ResetAccessFailedCountAsync(user);

        // Штамп безопасности попадает в токен; у старых аккаунтов его может не быть — создаём.
        if (string.IsNullOrEmpty(user.SecurityStamp))
            await _userManager.UpdateSecurityStampAsync(user);

        var roles = await _userManager.GetRolesAsync(user);

        var (token, expiration) = _jwtservice.GenerateToken(
            user.Id,
            user.Email ?? string.Empty,
            roles.ToList(),
            user.SecurityStamp
        );

        return (true, token, expiration, user.Email ?? string.Empty, user.Id, new List<string>());
    }

    private static string LockedOutMessage(AppUser user)
    {
        var minutes = user.LockoutEnd.HasValue
            ? (int)Math.Ceiling((user.LockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes)
            : 0;

        return minutes > 0
            ? $"Слишком много неудачных попыток входа. Попробуйте снова через {minutes} мин. или восстановите пароль."
            : "Слишком много неудачных попыток входа. Попробуйте позже или восстановите пароль.";
    }


    public async Task<Result<string>> ChangePasswordAsync(string userId, string oldPassword, string newPassword)
    {
        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
        {
            return Result<string>.Fail("Пользователь не найден.", ErrorType.NotFound);
        }

        // ChangePasswordAsync сам обновляет штамп безопасности — все выданные ранее токены отзываются.
        var result = await _userManager.ChangePasswordAsync(user, oldPassword, newPassword);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));

            return Result<string>.Fail(errors, ErrorType.Validation);
        }

        _logger.LogInformation("Password changed for user {UserId}", userId);

        return Result<string>.Ok("Пароль изменён. Войдите заново с новым паролем.");
    }


    public async Task<Result<string?>> GenerateResetCodeAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Result<string?>.Ok(null);

        var user = await _userManager.FindByEmailAsync(email.Trim());

        if (user == null)
        {
            // Не раскрываем, есть ли такой аккаунт: вызывающий ответит клиенту так же, как при успехе.
            _logger.LogInformation("Password reset requested for unknown email");
            return Result<string?>.Ok(null);
        }

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

        // Новый код заменяет прежний и обнуляет счётчик попыток и выданный токен сброса.
        await _cache.SetStringAsync(
            GetResetCodeCacheKey(email),
            code,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ResetCodeLifetime });
        await _cache.RemoveAsync(GetResetAttemptsCacheKey(email));
        await _cache.RemoveAsync(GetResetTokenCacheKey(email));

        return Result<string?>.Ok(code);
    }


    public async Task<Result<string>> VerifyResetCodeAsync(string email, string code)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
            return Result<string>.Fail(InvalidCodeMessage, ErrorType.Validation);

        var codeCacheKey = GetResetCodeCacheKey(email);
        var attemptsCacheKey = GetResetAttemptsCacheKey(email);

        var cachedCode = await _cache.GetStringAsync(codeCacheKey);

        // Аккаунта нет или код не выдавался/истёк — один и тот же ответ.
        if (cachedCode == null)
            return Result<string>.Fail(InvalidCodeMessage, ErrorType.Validation);

        if (!SecureEquals(cachedCode, code.Trim()))
        {
            var attempts = int.TryParse(await _cache.GetStringAsync(attemptsCacheKey), out var n) ? n : 0;
            attempts++;

            if (attempts >= MaxResetCodeAttempts)
            {
                await _cache.RemoveAsync(codeCacheKey);
                await _cache.RemoveAsync(attemptsCacheKey);
                _logger.LogWarning("Password reset code invalidated after {Attempts} wrong attempts", attempts);

                return Result<string>.Fail(
                    "Слишком много неверных попыток. Код больше не действует — запросите новый.",
                    ErrorType.Validation);
            }

            await _cache.SetStringAsync(
                attemptsCacheKey,
                attempts.ToString(),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ResetCodeLifetime });

            return Result<string>.Fail(InvalidCodeMessage, ErrorType.Validation);
        }

        await _cache.RemoveAsync(codeCacheKey);
        await _cache.RemoveAsync(attemptsCacheKey);

        // Одноразовый токен: без него reset-password не сработает, даже если кто-то знает email.
        var resetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        await _cache.SetStringAsync(
            GetResetTokenCacheKey(email),
            resetToken,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ResetTokenLifetime });

        return Result<string>.Ok(resetToken);
    }


    public async Task<Result<string>> ResetPasswordAsync(string email, string resetToken, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(resetToken))
            return Result<string>.Fail(ResetSessionExpiredMessage, ErrorType.Validation);

        var tokenCacheKey = GetResetTokenCacheKey(email);
        var cachedToken = await _cache.GetStringAsync(tokenCacheKey);

        if (!SecureEquals(cachedToken, resetToken.Trim()))
            return Result<string>.Fail(ResetSessionExpiredMessage, ErrorType.Validation);

        var user = await _userManager.FindByEmailAsync(email.Trim());

        if (user == null)
            return Result<string>.Fail(ResetSessionExpiredMessage, ErrorType.Validation);

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        // ResetPasswordAsync обновляет штамп безопасности — старые токены входа отзываются.
        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);

        if (!result.Succeeded)
        {
            // Токен сброса оставляем: пользователь исправит пароль под требования и отправит снова.
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));

            return Result<string>.Fail(errors, ErrorType.Validation);
        }

        await _cache.RemoveAsync(tokenCacheKey);

        // Владелец почты подтвердил себя — снимаем блокировку входа.
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        _logger.LogInformation("Password reset for user {UserId}", user.Id);

        return Result<string>.Ok("Пароль изменён. Теперь можно войти.");
    }


    public async Task<Result<string>> GetUserEmailAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
        {
            return Result<string>.Fail("User not found", ErrorType.NotFound);
        }

        return Result<string>.Ok(user.Email ?? string.Empty);
    }


    // Общие проверки смены ролей: роль из разрешённого списка, себе менять нельзя,
    // роль Admin выдаёт и снимает только SuperAdmin.
    private async Task<(AppUser? User, string? Role, Result<string>? Error)> PrepareRoleChangeAsync(
        string callerId, string userId, string roleName, string action)
    {
        var normalizedRole = NormalizeAssignableRole(roleName);

        if (normalizedRole == null)
            return (null, null, Result<string>.Fail($"Роль «{roleName}» нельзя {action} через API.", ErrorType.Forbidden));

        if (string.IsNullOrWhiteSpace(callerId))
            return (null, null, Result<string>.Fail("Нужно войти в аккаунт.", ErrorType.Unauthorized));

        if (string.Equals(callerId, userId, StringComparison.Ordinal))
            return (null, null, Result<string>.Fail("Нельзя менять роли самому себе.", ErrorType.Forbidden));

        if (normalizedRole == AdminRole)
        {
            var caller = await _userManager.FindByIdAsync(callerId);
            if (caller == null || !await _userManager.IsInRoleAsync(caller, SuperAdminRole))
                return (null, null, Result<string>.Fail("Роль администратора может выдавать и снимать только главный администратор.", ErrorType.Forbidden));
        }

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return (null, null, Result<string>.Fail("Пользователь не найден.", ErrorType.NotFound));

        if (await _userManager.IsInRoleAsync(user, SuperAdminRole))
            return (null, null, Result<string>.Fail("Роли главного администратора через API не меняются.", ErrorType.Forbidden));

        return (user, normalizedRole, null);
    }


    public async Task<Result<string>> AssignRoleAsync(string callerId, string userId, string roleName)
    {
        var (user, role, error) = await PrepareRoleChangeAsync(callerId, userId, roleName, "выдать");
        if (error != null)
            return error;

        if (!await _roleManager.RoleExistsAsync(role!))
        {
            return Result<string>.Fail(
                $"Роль «{role}» не существует.",
                ErrorType.Validation
            );
        }

        if (await _userManager.IsInRoleAsync(user!, role!))
        {
            return Result<string>.Ok($"У пользователя уже есть роль «{role}».");
        }

        var result = await _userManager.AddToRoleAsync(user!, role!);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));

            return Result<string>.Fail(errors, ErrorType.Validation);
        }

        // Старые токены с прежним набором ролей перестают действовать.
        await _userManager.UpdateSecurityStampAsync(user!);

        _logger.LogWarning("Role {Role} assigned to user {UserId} by {CallerId}", role, userId, callerId);

        return Result<string>.Ok($"Роль «{role}» выдана пользователю {user!.Email}.");

    }



    public async Task<Result<string>> RemoveRoleAsync(string callerId, string userId, string roleName)
    {
        var (user, role, error) = await PrepareRoleChangeAsync(callerId, userId, roleName, "снять");
        if (error != null)
            return error;

        if (!await _userManager.IsInRoleAsync(user!, role!))
            return Result<string>.Ok($"У пользователя нет роли «{role}».");

        var result = await _userManager.RemoveFromRoleAsync(user!, role!);

        if (!result.Succeeded)
        {
            var error2 = result.Errors.FirstOrDefault()?.Description
                        ?? "Не удалось снять роль.";

            return Result<string>.Fail(error2, ErrorType.Unknown);
        }

        await _userManager.UpdateSecurityStampAsync(user!);

        _logger.LogWarning("Role {Role} removed from user {UserId} by {CallerId}", role, userId, callerId);

        return Result<string>.Ok($"Роль «{role}» снята с пользователя {user!.Email}.");
    }

}
