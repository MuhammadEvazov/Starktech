using Application.DTOs.User;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers;


[ApiController]
[Route("api/User")]
[Authorize]
public class UserController : BaseController
{

    private readonly IUserService _userService;

    public UserController(IUserService userervice)
    {
        _userService = userervice;
    }


 [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] GetUserFilterDto filter)
    {
        var result = await _userService.GetUsersAsync(filter);

        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _userService.GetByIdAsync(id);

        if (!result.IsSuccess)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost("{id}/roles")]
    public async Task<IActionResult> AssignRole(string id, [FromBody] ChangeUserRoleDto dto)
    {
        var result = await _userService.AssignRoleAsync(id, dto.Role);

        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("{id}/roles/{role}")]
    public async Task<IActionResult> RemoveRole(string id, string role)
    {
        var result = await _userService.RemoveRoleAsync(id, role);

        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var result = await _userService.DeleteAsync(id);

        if (!result.IsSuccess)
            return BadRequest(result);

        return Ok(result);
    }

}
