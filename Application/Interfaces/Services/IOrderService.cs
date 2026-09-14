using Application.DTOs.Order;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IOrderService
{
    Task<Result<PageResult<GetOrderDto>>> GetAllAsync(GetOrderFilterDto filter);
    Task<Result<GetOrderDto>> GetByIdAsync(Guid id);
    Task<Result<CreateOrderResponseDto>> CreateAsync(CreateOrderDto dto);
    Task<Result<GetOrderDto>> UpdateStatusAsync(Guid id, UpdateOrderStatusDto dto);
    Task<Result<bool>> CancelAsync(Guid id);

    Task<Result<OrderItemResponseDto>> AddItemAsync(Guid orderId, AddOrderItemDto dto);
    Task<Result<OrderItemResponseDto>> UpdateItemQuantityAsync(Guid orderId, Guid itemId, UpdateOrderItemDto dto);
    Task<Result<bool>> RemoveItemAsync(Guid orderId, Guid itemId);
}
