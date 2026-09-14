using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IOrderItemPhotoRepository
{
    Task<OrderItemPhoto?> GetByIdAsync(Guid id);
    Task<List<OrderItemPhoto>> GetByOrderItemIdAsync(Guid orderItemId, bool includeDeleted = false);
    Task<OrderItemPhoto> AddAsync(OrderItemPhoto photo);
    Task<bool> UpdateAsync(OrderItemPhoto photo);
}
