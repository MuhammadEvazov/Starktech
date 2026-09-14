using Domain.Entities;
using Domain.Enums;

namespace Application.Interfaces.Repositories;

public interface IRolePermissionRepository
{
    Task<List<RolePermission>> GetAllAsync();
    Task<List<RolePermission>> GetByRoleAsync(UserRole role);
    Task<RolePermission?> GetAsync(UserRole role, string permissionKey);
    Task<bool> IsGrantedAsync(UserRole role, string permissionKey);
    Task<RolePermission> AddAsync(RolePermission permission);
    Task<bool> UpdateAsync(RolePermission permission);
}
