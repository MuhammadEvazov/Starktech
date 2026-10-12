using Application.DTOs.Auth;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;

namespace Application.Services;

public class AuthService : IAuthService
{
    private readonly IIdentityService _identityService;
    private readonly IEmailService _emailService;

    public AuthService(IIdentityService identityService, IEmailService emailService)
    {
        _identityService = identityService;
        _emailService = emailService;
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
            FullName = dto.FullName,
            PhoneNumber = dto.PhoneNumber,
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
            return Result<string>.Fail("Passwords do not match", ErrorType.Validation);

        if (dto.OldPassword == dto.NewPassword)
            return Result<string>.Fail("New password must be different from the old one", ErrorType.Validation);

        return await _identityService.ChangePasswordAsync(userId, dto.OldPassword, dto.NewPassword);
    }


    public async Task<Result<string>> SendPasswordResetEmailAsync(SendEmailDto dto)
    {
        var codeResult = await _identityService.GenerateResetCodeAsync(dto.Email);
        if (!codeResult.IsSuccess)
            return codeResult;

        try
        {
            await _emailService.SendEmailAsync(dto.Email, "Password Reset Code", $"Your reset code: {codeResult.Data}");
            return Result<string>.Ok("Reset code sent to your email.");
        }
        catch (Exception ex)
        {
            return Result<string>.Fail($"Failed to send email: {ex.Message}", ErrorType.Unknown);
        }
    }


    public async Task<Result<bool>> VerifyCodeAsync(VerifyCodeDto dto)
        => await _identityService.VerifyResetCodeAsync(dto.Email, dto.Code);


    public async Task<Result<string>> ResetPasswordAsync(ResetPasswordDto dto)
    {
        if (dto.NewPassword != dto.ConfirmPassword)
            return Result<string>.Fail("Passwords do not match", ErrorType.Validation);

        return await _identityService.ResetPasswordAsync(dto.Email, dto.NewPassword);
    }



    public async Task<Result<string>> AssignRoleAsync(AssignRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.UserId))
            return Result<string>.Fail("UserId is required", ErrorType.Validation);

        if (string.IsNullOrWhiteSpace(dto.RoleName))
            return Result<string>.Fail("RoleName is required", ErrorType.Validation);

        return await _identityService.AssignRoleAsync(dto.UserId, dto.RoleName);
    }


    public async Task<Result<string>> RemoveRoleAsync(AssignRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.UserId) || string.IsNullOrWhiteSpace(dto.RoleName))
            return Result<string>.Fail("UserId and RoleName are required", ErrorType.Validation);

        return await _identityService.RemoveRoleAsync(dto.UserId, dto.RoleName);
    }


}
