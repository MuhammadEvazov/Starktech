using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IOrderItemRepository
{
    Task<OrderItem?> GetByIdAsync(Guid id);
    Task<OrderItem> AddAsync(OrderItem item);
    Task<bool> UpdateAsync(OrderItem item);
    Task<bool> DeleteAsync(OrderItem item);
}
