using Application.DTOs.RolePermission;
using Application.Interfaces.Services;
using Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/role-permissions")]
[Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.RolesPermissionsManage)]
public class RolePermissionController : BaseController
{
    private readonly IRolePermissionService _rolePermissionService;
    private readonly ILogger<RolePermissionController> _logger;

    public RolePermissionController(IRolePermissionService rolePermissionService, ILogger<RolePermissionController> logger)
    {
        _rolePermissionService = rolePermissionService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _rolePermissionService.GetAllAsync();
        return HandleResult(result);
    }

    [HttpGet("role/{role}")]
    public async Task<IActionResult> GetByRole(UserRole role)
    {
        var result = await _rolePermissionService.GetByRoleAsync(role);
        return HandleResult(result);
    }

    [HttpPut]
    public async Task<IActionResult> SetPermission(SetRolePermissionDto dto)
    {
        var result = await _rolePermissionService.SetPermissionAsync(dto);
        if (result.IsSuccess)
            _logger.LogWarning("Permission {Permission} for role {Role} set to {IsGranted} by {CallerId}",
                dto.PermissionKey, dto.Role, dto.IsGranted, GetCurrentUserId());
        return HandleResult(result);
    }
}
