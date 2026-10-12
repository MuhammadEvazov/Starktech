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

    // SuperAdmin is deliberately absent: it is granted only by DataSeed, never through the API.
    // "User" is the role RegisterAsync assigns; "Client" is the seeded UserRole.Client equivalent.
    private static readonly string[] AssignableRoles =
    {
        "User",
        "Client",
        "Admin"
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

    private static string GetResetCodeCacheKey(string email) =>
        $"password-reset-code:{email.Trim().ToLowerInvariant()}";

    private static string GetResetVerifiedCacheKey(string email) =>
        $"password-reset-verified:{email.Trim().ToLowerInvariant()}";



    public async Task<(bool Success, string UserId, List<string> Errors)> RegisterAsync(RegisterDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return (false, string.Empty, new List<string> { "Email is required" });
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return (false, string.Empty, new List<string> { "Password is required" });
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
        var user = await _userManager.FindByEmailAsync(dto.Email);

        if (user == null)
        {
            return (false, string.Empty, default, string.Empty, string.Empty, new List<string> { "Invalid credentials." });
        }

        var valid = await _userManager.CheckPasswordAsync(user, dto.Password);

        if (!valid)
        {
            return (false, string.Empty, default, string.Empty, string.Empty, new List<string> { "Invalid credentials." });
        }

        var roles = await _userManager.GetRolesAsync(user);

        var (token, expiration) = _jwtservice.GenerateToken(
            user.Id,
            user.Email ?? string.Empty,
            roles.ToList()
        );

        return (true, token, expiration, user.Email ?? string.Empty, user.Id, new List<string>());
    }


    public async Task<Result<string>> ChangePasswordAsync(string userId, string oldPassword, string newPassword)
    {
        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
        {
            return Result<string>.Fail("User not found", ErrorType.NotFound);
        }

        var result = await _userManager.ChangePasswordAsync(user, oldPassword, newPassword);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));

            return Result<string>.Fail(errors, ErrorType.Validation);
        }

        return Result<string>.Ok("Password changed successfully.");
    }


    public async Task<Result<string>> GenerateResetCodeAsync(string email)
    {
        var user = await _userManager.FindByEmailAsync(email);

        if (user == null)
        {
            return Result<string>.Fail("User not found", ErrorType.NotFound);
        }

        var code = new Random().Next(100000, 999999).ToString();

        await _cache.SetStringAsync(
            GetResetCodeCacheKey(email),
            code,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ResetCodeLifetime });

        return Result<string>.Ok(code);
    }


    public async Task<Result<bool>> VerifyResetCodeAsync(string email, string code)
    {
        var user = await _userManager.FindByEmailAsync(email);

        if (user == null)
        {
            return Result<bool>.Fail("User not found", ErrorType.NotFound);
        }

        var codeCacheKey = GetResetCodeCacheKey(email);
        var cachedCode = await _cache.GetStringAsync(codeCacheKey);

        if (cachedCode == null || cachedCode != code)
        {
            return Result<bool>.Fail(
                "Invalid or expired verification code.",
                ErrorType.Validation
            );
        }

        await _cache.RemoveAsync(codeCacheKey);

        await _cache.SetStringAsync(
            GetResetVerifiedCacheKey(email),
            "true",
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ResetCodeLifetime });

        return Result<bool>.Ok(true);
    }


    public async Task<Result<string>> ResetPasswordAsync(string email, string newPassword)
    {
        var user = await _userManager.FindByEmailAsync(email);

        if (user == null)
        {
            return Result<string>.Fail("User not found", ErrorType.NotFound);
        }

        var verifiedCacheKey = GetResetVerifiedCacheKey(email);
        var verified = await _cache.GetStringAsync(verifiedCacheKey);

        if (verified == null)
        {
            return Result<string>.Fail(
                "Reset code has not been verified.",
                ErrorType.Unauthorized
            );
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));

            return Result<string>.Fail(errors, ErrorType.Validation);
        }

        await _cache.RemoveAsync(verifiedCacheKey);

        return Result<string>.Ok("Password reset successfully.");
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


    public async Task<Result<string>> AssignRoleAsync(string userId, string roleName)
    {
        var normalizedRole = NormalizeAssignableRole(roleName);

        if (normalizedRole == null)
        {
            return Result<string>.Fail(
                $"Role '{roleName}' cannot be assigned through the API.",
                ErrorType.Forbidden
            );
        }

        roleName = normalizedRole;

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
        {
            return Result<string>.Fail("User not found", ErrorType.NotFound);
        }

        if (!await _roleManager.RoleExistsAsync(roleName))
        {
            return Result<string>.Fail(
                $"Role '{roleName}' does not exist.",
                ErrorType.Validation
            );
        }

        if (await _userManager.IsInRoleAsync(user, roleName))
        {
            return Result<string>.Ok($"User already has the role '{roleName}'.");
        }

        var result = await _userManager.AddToRoleAsync(user, roleName);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));

            return Result<string>.Fail(errors, ErrorType.Validation);
        }

        return Result<string>.Ok($"Role '{roleName}' assigned to {user.Email}.");

    }



    public async Task<Result<string>> RemoveRoleAsync(string userId, string roleName)
    {
        var normalizedRole = NormalizeAssignableRole(roleName);

        if (normalizedRole == null)
        {
            return Result<string>.Fail(
                $"Role '{roleName}' cannot be removed through the API.",
                ErrorType.Forbidden
            );
        }

        roleName = normalizedRole;

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
        {
            return Result<string>.Fail("User not found", ErrorType.NotFound);
        }

        var result = await _userManager.RemoveFromRoleAsync(user, roleName);

        if (!result.Succeeded)
        {
            var error = result.Errors.FirstOrDefault()?.Description
                        ?? "Error removing role.";

            return Result<string>.Fail(error, ErrorType.Unknown);
        }

        return Result<string>.Ok($"Role '{roleName}' removed from {user.Email}.");
    }

}
