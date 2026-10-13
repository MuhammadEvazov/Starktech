using Application.DTOs.Auth;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class AuthService : IAuthService
{
    private readonly IIdentityService _identityService;
    private readonly IEmailService _emailService;
    private readonly ILogger<AuthService> _logger;

    // Одинаковый ответ и для существующего, и для несуществующего email — перебором нельзя узнать, кто зарегистрирован.
    private const string ResetCodeSentMessage =
        "Если аккаунт с таким email существует, мы отправили на него код. Проверьте почту (и папку «Спам»).";

    public AuthService(IIdentityService identityService, IEmailService emailService, ILogger<AuthService> logger)
    {
        _identityService = identityService;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<Result<RegisterResponseDto>> RegisterAsync(RegisterDto dto)
    {
        var (success, userId, errors) = await _identityService.RegisterAsync(dto);

        if (!success)
        {
            var combinedError = string.Join(", ", errors);
            return Result<RegisterResponseDto>.Fail(combinedError, ErrorType.Validation);
        }
        return Result<RegisterResponseDto>.Ok(new RegisterResponseDto
        {
            Id = userId,
            Email = dto.Email,
            FullName = dto.FullName.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            RegisteredAt = DateTime.UtcNow
        });
    }


    public async Task<Result<LoginResponseDto>> LoginAsync(LoginDto dto)
    {
        var (success, token, expiration, email, userId, errors) = await _identityService.LoginAsync(dto);

        if (!success)
        {
            var combinedError = string.Join(", ", errors);
            return Result<LoginResponseDto>.Fail(combinedError, ErrorType.Validation);
        }

        return Result<LoginResponseDto>.Ok(new LoginResponseDto
        {
            Token = token,
            Expiration = expiration,
            Email = email,
            UserId = userId
        });
    }




    public async Task<Result<string>> ChangePasswordAsync(string userId, ChangePasswordDto dto)
    {
        if (dto.NewPassword != dto.ConfirmPassword)
            return Result<string>.Fail("Пароли не совпадают.", ErrorType.Validation);

        if (dto.OldPassword == dto.NewPassword)
            return Result<string>.Fail("Новый пароль должен отличаться от старого.", ErrorType.Validation);

        return await _identityService.ChangePasswordAsync(userId, dto.OldPassword, dto.NewPassword);
    }


    public async Task<Result<string>> SendPasswordResetEmailAsync(SendEmailDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return Result<string>.Fail("Укажите email.", ErrorType.Validation);

        var codeResult = await _identityService.GenerateResetCodeAsync(dto.Email);
        if (!codeResult.IsSuccess)
            return Result<string>.Fail(codeResult.Errors, codeResult.ErrorType);

        // Аккаунта нет — письмо не шлём, но отвечаем так же, как при успехе.
        if (string.IsNullOrEmpty(codeResult.Data))
            return Result<string>.Ok(ResetCodeSentMessage);

        try
        {
            await _emailService.SendEmailAsync(
                dto.Email.Trim(),
                "Код для сброса пароля",
                $"Ваш код для сброса пароля: {codeResult.Data}. Код действует 10 минут. Если вы не запрашивали сброс, просто проигнорируйте это письмо.");
            return Result<string>.Ok(ResetCodeSentMessage);
        }
        catch (Exception ex)
        {
            // Подробности SMTP — только в лог: клиенту они ни к чему и раскрывают устройство сервера.
            _logger.LogError(ex, "Failed to send password reset email");
            return Result<string>.Fail("Не удалось отправить письмо. Попробуйте позже.", ErrorType.Unknown);
        }
    }


    public async Task<Result<VerifyCodeResponseDto>> VerifyCodeAsync(VerifyCodeDto dto)
    {
        var result = await _identityService.VerifyResetCodeAsync(dto.Email, dto.Code);

        if (!result.IsSuccess)
            return Result<VerifyCodeResponseDto>.Fail(result.Errors, result.ErrorType);

        return Result<VerifyCodeResponseDto>.Ok(new VerifyCodeResponseDto { ResetToken = result.Data! });
    }


    public async Task<Result<string>> ResetPasswordAsync(ResetPasswordDto dto)
    {
        if (dto.NewPassword != dto.ConfirmPassword)
            return Result<string>.Fail("Пароли не совпадают.", ErrorType.Validation);

        return await _identityService.ResetPasswordAsync(dto.Email, dto.ResetToken, dto.NewPassword);
    }



    public async Task<Result<string>> AssignRoleAsync(string callerId, AssignRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.UserId))
            return Result<string>.Fail("Не указан пользователь.", ErrorType.Validation);

        if (string.IsNullOrWhiteSpace(dto.RoleName))
            return Result<string>.Fail("Не указана роль.", ErrorType.Validation);

        return await _identityService.AssignRoleAsync(callerId, dto.UserId, dto.RoleName);
    }


    public async Task<Result<string>> RemoveRoleAsync(string callerId, AssignRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.UserId) || string.IsNullOrWhiteSpace(dto.RoleName))
            return Result<string>.Fail("Не указаны пользователь и роль.", ErrorType.Validation);

        return await _identityService.RemoveRoleAsync(callerId, dto.UserId, dto.RoleName);
    }


}
