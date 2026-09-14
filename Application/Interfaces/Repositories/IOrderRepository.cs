using Application.DTOs.Order;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IOrderRepository
{
    Task<PageResult<Order>> GetAllAsync(GetOrderFilterDto filter);
    Task<Order?> GetByIdAsync(Guid id);
    Task<Order?> GetByIdTrackedAsync(Guid id);
    Task<Order> AddAsync(Order order);
    Task<bool> UpdateAsync(Order order);
    Task<bool> IsOrderNumberTakenAsync(string orderNumber);
    Task<bool> HasDeliveredOrderForProductAsync(Guid userId, Guid productId);
    Task LockForUpdateAsync(Guid id);
}
