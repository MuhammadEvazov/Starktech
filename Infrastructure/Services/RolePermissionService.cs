using Application.DTOs.RolePermission;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class RolePermissionService : IRolePermissionService
{
    private readonly IRolePermissionRepository _rolePermissionRepository;
    private readonly ILogger<RolePermissionService> _logger;

    public RolePermissionService(
        IRolePermissionRepository rolePermissionRepository,
        ILogger<RolePermissionService> logger)
    {
        _rolePermissionRepository = rolePermissionRepository;
        _logger = logger;
    }

    public async Task<Result<List<GetRolePermissionDto>>> GetAllAsync()
    {
        var permissions = await _rolePermissionRepository.GetAllAsync();

        return Result<List<GetRolePermissionDto>>.Ok(permissions.Select(ToDto).ToList());
    }

    public async Task<Result<List<GetRolePermissionDto>>> GetByRoleAsync(UserRole role)
    {
        var permissions = await _rolePermissionRepository.GetByRoleAsync(role);

        return Result<List<GetRolePermissionDto>>.Ok(permissions.Select(ToDto).ToList());
    }

    public async Task<Result<GetRolePermissionDto>> SetPermissionAsync(SetRolePermissionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.PermissionKey))
            return Result<GetRolePermissionDto>.Fail("Permission key is required", ErrorType.Validation);

        var existing = await _rolePermissionRepository.GetAsync(dto.Role, dto.PermissionKey);

        if (existing != null)
        {
            existing.IsGranted = dto.IsGranted;
            await _rolePermissionRepository.UpdateAsync(existing);

            _logger.LogInformation("Permission {Key} for role {Role} set to {Granted}", dto.PermissionKey, dto.Role, dto.IsGranted);

            return Result<GetRolePermissionDto>.Ok(ToDto(existing));
        }

        var permission = new RolePermission
        {
            Role = dto.Role,
            PermissionKey = dto.PermissionKey,
            IsGranted = dto.IsGranted
        };

        await _rolePermissionRepository.AddAsync(permission);

        _logger.LogInformation("Permission {Key} created for role {Role} with value {Granted}", dto.PermissionKey, dto.Role, dto.IsGranted);

        return Result<GetRolePermissionDto>.Ok(ToDto(permission));
    }

    private static GetRolePermissionDto ToDto(RolePermission permission) => new()
    {
        Id = permission.Id,
        Role = permission.Role,
        PermissionKey = permission.PermissionKey,
        IsGranted = permission.IsGranted
    };
}
