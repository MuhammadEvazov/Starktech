using Application.DTOs.Profile;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IProfileService
{
    Task<Result<ProfileDto>> GetProfileAsync(string userId);

    Task<Result<ProfileDto>> UpdateProfileAsync(string userId, UpdateProfileDto dto);

    Task<bool> UpdateUserProfileAsync(string userId, IFormFile? file);
}
