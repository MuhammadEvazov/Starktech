using Application.DTOs.User;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/User")]
[Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersManage)]
public class UserController : BaseController
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] GetUserFilterDto filter)
    {
        var result = await _userService.GetUsersAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _userService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost("{id}/roles")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    public async Task<IActionResult> AssignRole(string id, [FromBody] ChangeUserRoleDto dto)
    {
        var result = await _userService.AssignRoleAsync(id, dto.Role);
        return HandleResult(result);
    }

    [HttpDelete("{id}/roles/{role}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.UsersChangeRole)]
    public async Task<IActionResult> RemoveRole(string id, string role)
    {
        var result = await _userService.RemoveRoleAsync(id, role);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var result = await _userService.DeleteAsync(id);
        return HandleResult(result);
    }
}
