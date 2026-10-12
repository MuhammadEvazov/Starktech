using Application.DTOs.AdminTelegramBinding;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers;

[ApiController]
[Route("api/telegram-bindings")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class AdminTelegramBindingController : BaseController
{
    private readonly IAdminTelegramBindingService _bindingService;

    public AdminTelegramBindingController(IAdminTelegramBindingService bindingService)
    {
        _bindingService = bindingService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetAdminTelegramBindingFilterDto filter)
    {
        var result = await _bindingService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _bindingService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost("link/initiate")]
    public async Task<IActionResult> InitiateLink(InitiateLinkDto dto)
    {
        var result = await _bindingService.InitiateLinkAsync(dto);
        return HandleResult(result);
    }

    [HttpPost("link/confirm")]
    public async Task<IActionResult> ConfirmLink(ConfirmLinkDto dto)
    {
        var result = await _bindingService.ConfirmLinkAsync(dto);
        return HandleResult(result);
    }

    [HttpPost("{userId}/unlink")]
    public async Task<IActionResult> Unlink(Guid userId)
    {
        var result = await _bindingService.UnlinkAsync(userId);
        return HandleResult(result);
    }
}
