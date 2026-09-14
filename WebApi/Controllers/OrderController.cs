using Application.DTOs.Order;
using Application.Interfaces.Services;
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
    public async Task<IActionResult> GetAll([FromQuery] GetOrderFilterDto filter)
    {
        var result = await _orderService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _orderService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderDto dto)
    {
        var result = await _orderService.CreateAsync(dto);
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
