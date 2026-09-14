using Application.DTOs.RolePermission;
using Application.Result;
using Application.Results;
using Domain.Enums;

namespace Application.Interfaces.Services;

public interface IRolePermissionService
{
    Task<Result<List<GetRolePermissionDto>>> GetAllAsync();
    Task<Result<List<GetRolePermissionDto>>> GetByRoleAsync(UserRole role);
    Task<Result<GetRolePermissionDto>> SetPermissionAsync(SetRolePermissionDto dto);
}
