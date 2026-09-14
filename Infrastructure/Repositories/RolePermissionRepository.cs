using Application.Interfaces.Repositories;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class RolePermissionRepository(AppDbContext context) : IRolePermissionRepository
{
    public async Task<List<RolePermission>> GetAllAsync()
    {
        return await context.RolePermissions
            .OrderBy(p => p.Role)
            .ThenBy(p => p.PermissionKey)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<List<RolePermission>> GetByRoleAsync(UserRole role)
    {
        return await context.RolePermissions
            .Where(p => p.Role == role)
            .OrderBy(p => p.PermissionKey)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<RolePermission?> GetAsync(UserRole role, string permissionKey)
    {
        return await context.RolePermissions
            .FirstOrDefaultAsync(p => p.Role == role && p.PermissionKey == permissionKey);
    }

    public async Task<bool> IsGrantedAsync(UserRole role, string permissionKey)
    {
        return await context.RolePermissions
            .AsNoTracking()
            .AnyAsync(p => p.Role == role && p.PermissionKey == permissionKey && p.IsGranted);
    }

    public async Task<RolePermission> AddAsync(RolePermission permission)
    {
        await context.RolePermissions.AddAsync(permission);
        await context.SaveChangesAsync();
        return permission;
    }

    public async Task<bool> UpdateAsync(RolePermission permission)
    {
        context.RolePermissions.Update(permission);
        await context.SaveChangesAsync();
        return true;
    }
}
