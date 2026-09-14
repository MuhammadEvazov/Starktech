using System.Security.Claims;
using Application.Interfaces.Repositories;
using Domain.Enums;
using Microsoft.AspNetCore.Authorization;

namespace WebApi.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IRolePermissionRepository _rolePermissionRepository;

    public PermissionAuthorizationHandler(IRolePermissionRepository rolePermissionRepository)
    {
        _rolePermissionRepository = rolePermissionRepository;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        foreach (var roleClaim in context.User.FindAll(ClaimTypes.Role))
        {
            if (roleClaim.Value == nameof(UserRole.SuperAdmin))
            {
                context.Succeed(requirement);
                return;
            }

            if (Enum.TryParse<UserRole>(roleClaim.Value, out var role) &&
                await _rolePermissionRepository.IsGrantedAsync(role, requirement.Permission))
            {
                context.Succeed(requirement);
                return;
            }
        }
    }
}
