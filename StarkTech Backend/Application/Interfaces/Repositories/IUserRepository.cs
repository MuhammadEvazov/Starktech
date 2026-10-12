using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(string userId);
    Task<User?> GetByIdTrackedAsync(string userId);
    Task<bool> UpdateAsync(User user);
    Task AddAsync(User user);
    Task<bool> ExistsAsync(Guid id);
    Task<User?> GetByGuidIdAsync(Guid id);
    Task<bool> TryAdjustCoinsBalanceAsync(Guid userId, int delta);
}
