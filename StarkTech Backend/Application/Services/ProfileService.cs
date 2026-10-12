using Application.DTOs.Profile;
using Application.Result;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Application.Interfaces.Services;
using Application.Interfaces.Repositories;
using Application.Results;

namespace Application.Services;

public class ProfileService : IProfileService
{
    private readonly IUserRepository _userRepository;
    private readonly IIdentityService _identityService;
    private readonly IFileService _fileService;
    private readonly ILogger<ProfileService> _logger;

    public ProfileService(
        IIdentityService identityService,
        IFileService fileService,
        ILogger<ProfileService> logger,
        IUserRepository userRepository)
    {
        _identityService = identityService;
        _fileService = fileService;
        _logger = logger;
        _userRepository = userRepository;
    }

    public async Task<Result<ProfileDto>> GetProfileAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Result<ProfileDto>.Fail(
                "UserId обязателен",
                ErrorType.Validation
            );
        }

        var emailResult = await _identityService.GetUserEmailAsync(userId);

        if (!emailResult.IsSuccess)
        {
            return Result<ProfileDto>.Fail(
                "Пользователь не найден",
                ErrorType.NotFound
            );
        }

        var user = await _userRepository.GetByIdAsync(userId);

        if (user is null)
        {
            // Учётная запись без профиля — создаём его, а не показываем ошибку в кабинете.
            user = Domain.Entities.User.Create(userId, emailResult.Data ?? string.Empty);
            await _userRepository.AddAsync(user);
            _logger.LogWarning("Missing profile recreated for user {UserId}", userId);
        }

        return Result<ProfileDto>.Ok(new ProfileDto
        {
            Id = user.Id,
            FullName = user.FullName!,
            Email = emailResult.Data ?? string.Empty,
            Bio = user.Bio,
            AvatarUrl = user.AvatarUrl,
            CoinsBalance = user.CoinsBalance,
            PhoneNumber = user.PhoneNumber,
            DeliveryCityId = user.DefaultDeliveryCityId,
            DeliveryAddress = user.DefaultDeliveryAddress
        });
    }

    public async Task<Result<ProfileDto>> UpdateProfileAsync(string userId, UpdateProfileDto dto)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Result<ProfileDto>.Fail(
                "UserId обязателен",
                ErrorType.Validation
            );
        }

        var emailResult = await _identityService.GetUserEmailAsync(userId);

        if (!emailResult.IsSuccess)
        {
            return Result<ProfileDto>.Fail(
                "Пользователь не найден",
                ErrorType.NotFound
            );
        }

        var user = await _userRepository.GetByIdTrackedAsync(userId);

        if (user is null)
        {
            return Result<ProfileDto>.Fail(
                "Профиль пользователья не найден",
                ErrorType.NotFound
            );
        }

        user.UpdateProfile(dto.FullName, dto.Bio);
        user.UpdateDeliveryDefaults(dto.PhoneNumber, dto.DeliveryCityId, dto.DeliveryAddress);

        var success = await _userRepository.UpdateAsync(user);

        if (!success)
        {
            return Result<ProfileDto>.Fail(
                "Не удалось обновить профиль",
                ErrorType.ServerError
            );
        }

        _logger.LogInformation("Profile updated for user {UserId}", userId);

        return Result<ProfileDto>.Ok(new ProfileDto
        {
            Id = user.Id,
            FullName = user.FullName!,
            Email = emailResult.Data ?? string.Empty,
            Bio = user.Bio,
            AvatarUrl = user.AvatarUrl,
            CoinsBalance = user.CoinsBalance,
            PhoneNumber = user.PhoneNumber,
            DeliveryCityId = user.DefaultDeliveryCityId,
            DeliveryAddress = user.DefaultDeliveryAddress
        });
    }

    public async Task<bool> UpdateUserProfileAsync(string userId, IFormFile? file)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return false;

        if (file == null || file.Length == 0)
            return false;

        var user = await _userRepository.GetByIdTrackedAsync(userId);

        if (user is null)
            return false;

        var avatarUrl = await _fileService.UploadAsync(file, "profile");

        if (string.IsNullOrWhiteSpace(avatarUrl))
            return false;

        var previousAvatarUrl = user.AvatarUrl;

        user.UpdateAvatar(avatarUrl);

        var success = await _userRepository.UpdateAsync(user);

        if (!success)
            return false;

        if (!string.IsNullOrWhiteSpace(previousAvatarUrl))
            await _fileService.DeleteAsync(previousAvatarUrl);

        _logger.LogInformation("Avatar updated for user {UserId}", userId);

        return true;
    }
}