using Application.DTOs.Order;
using Application.Interfaces.Services;
using Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/orders")]
public class OrderController : BaseController
{
    private readonly IOrderService _orderService;

    public OrderController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll([FromQuery] GetOrderFilterDto filter)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersView);
        var result = await _orderService.GetAllAsync(filter, scope);
        return HandleResult(result);
    }

    // GET /api/orders/my — личный кабинет: только заказы текущего пользователя,
    // даже если у него есть право видеть все заказы (админ тоже видит здесь только свои).
    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMine([FromQuery] GetOrderFilterDto filter)
    {
        var owner = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        var result = await _orderService.GetAllAsync(filter, owner);
        return HandleResult(result);
    }

    [HttpGet("my/{id}")]
    [Authorize]
    public async Task<IActionResult> GetMineById(Guid id)
    {
        var owner = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        var result = await _orderService.GetByIdAsync(id, owner);
        return HandleResult(result);
    }

    // ─── Клиент меняет состав своего заказа («Новый»/«Подтверждён») ───
    [HttpPost("my/{orderId}/items")]
    [Authorize]
    public async Task<IActionResult> AddMyItem(Guid orderId, AddOrderItemDto dto)
    {
        var owner = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        var result = await _orderService.AddItemAsync(orderId, dto, owner);
        return HandleResult(result);
    }

    [HttpPut("my/{orderId}/items/{itemId}")]
    [Authorize]
    public async Task<IActionResult> UpdateMyItem(Guid orderId, Guid itemId, UpdateOrderItemDto dto)
    {
        var owner = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        var result = await _orderService.UpdateItemQuantityAsync(orderId, itemId, dto, owner);
        return HandleResult(result);
    }

    [HttpDelete("my/{orderId}/items/{itemId}")]
    [Authorize]
    public async Task<IActionResult> RemoveMyItem(Guid orderId, Guid itemId)
    {
        var owner = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        var result = await _orderService.RemoveItemAsync(orderId, itemId, owner);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await GetOwnerScopeAsync(UserPermissions.OrdersView);
        var result = await _orderService.GetByIdAsync(id, scope);
        return HandleResult(result);
    }

    // Заказ оформляет только вошедший пользователь — гостевых заказов без владельца больше нет.
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(CreateOrderDto dto)
    {
        // The order owner is never taken from the request body: guests get no owner,
        // customers always order for themselves, only staff may place orders for other users.
        // A website order always belongs to whoever placed it — staff included; only manual
        // (Instagram) orders created from the admin panel may target another user.
        // Источник «вручную» (Instagram и т.п.) может указать только сотрудник с правом orders.manual-create.
        var canCreateManual = User.Identity?.IsAuthenticated == true
            && await HasPermissionAsync(UserPermissions.OrdersManualCreate);
        if (!canCreateManual)
            dto.Source = OrderSource.Website;

        if (User.Identity?.IsAuthenticated != true)
            dto.UserId = null;
        else if (dto.Source == OrderSource.Website || !canCreateManual)
            dto.UserId = await GetCurrentProfileIdAsync();

        // Процент предоплаты запоминается внутри CreateAsync.
        var result = await _orderService.CreateAsync(dto);
        return HandleResult(result);
    }

    // GET /api/orders/{id}/activity — журнал изменений заказа (для админки)
    [HttpGet("{id}/activity")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> GetActivity(Guid id, [FromServices] IOrderActivityService activity)
    {
        var result = await activity.GetByOrderAsync(id);
        return HandleResult(result);
    }

    // POST /api/orders/{id}/activity/seen — сотрудник просмотрел изменения клиента
    [HttpPost("{id}/activity/seen")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> MarkActivitySeen(Guid id, [FromServices] IOrderActivityService activity)
    {
        var result = await activity.MarkSeenAsync(id);
        return HandleResult(result);
    }

    [HttpPut("{id}/status")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> UpdateStatus(Guid id, UpdateOrderStatusDto dto)
    {
        var result = await _orderService.UpdateStatusAsync(id, dto);
        return HandleResult(result);
    }

    [HttpPost("{id}/cancel")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var result = await _orderService.CancelAsync(id);
        return HandleResult(result);
    }

    [HttpPost("{orderId}/items")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> AddItem(Guid orderId, AddOrderItemDto dto)
    {
        var result = await _orderService.AddItemAsync(orderId, dto);
        return HandleResult(result);
    }

    [HttpPut("{orderId}/items/{itemId}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> UpdateItem(Guid orderId, Guid itemId, UpdateOrderItemDto dto)
    {
        var result = await _orderService.UpdateItemQuantityAsync(orderId, itemId, dto);
        return HandleResult(result);
    }

    [HttpDelete("{orderId}/items/{itemId}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersEdit)]
    public async Task<IActionResult> RemoveItem(Guid orderId, Guid itemId)
    {
        var result = await _orderService.RemoveItemAsync(orderId, itemId);
        return HandleResult(result);
    }
}
