using Application.DTOs.Notification;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
public class NotificationController : BaseController
{
    private readonly INotificationService _notificationService;

    public NotificationController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetNotificationFilterDto filter)
    {
        var result = await _notificationService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _notificationService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> Create(CreateNotificationDto dto)
    {
        var result = await _notificationService.CreateAsync(dto);
        return HandleResult(result);
    }
}
