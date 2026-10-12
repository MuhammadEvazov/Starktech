using Application.DTOs.User;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IUserService
{
    Task<Result<PageResult<GetUserDto>>> GetUsersAsync(GetUserFilterDto dto);
    Task<Result<GetUserDto>> GetByIdAsync(string id);
    Task<Result<UpdateUserResponseDto>> UpdateAsync(string id, UpdateUserDto dto);
    Task<Result<bool>> DeleteAsync(string id);

    Task<bool> UpdateUserProfileAsync(string userId, IFormFile file);

    Task<List<UserDropdownDto>> GetAllForDropdownAsync();

    Task<Result<bool>> AssignRoleAsync(string userId, string role);
    Task<Result<bool>> RemoveRoleAsync(string userId, string role);
}
