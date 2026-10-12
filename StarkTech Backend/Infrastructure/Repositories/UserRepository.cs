using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class UserRepository(AppDbContext context) : IUserRepository
{
    public async Task<User?> GetByIdAsync(string userId)
    {
        return await context.Clients
             .AsNoTracking()
             .FirstOrDefaultAsync(s => s.AppUserId == userId);
    }

    public async Task<User?> GetByIdTrackedAsync(string userId)
    {
        return await context.Clients
             .FirstOrDefaultAsync(s => s.AppUserId == userId);
    }

    public async Task<bool> UpdateAsync(User user)
    {
        context.Clients.Update(user);
        // CoinsBalance changes only through TryAdjustCoinsBalanceAsync; never overwrite it with a stale value.
        context.Entry(user).Property(u => u.CoinsBalance).IsModified = false;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task AddAsync(User user)
    {
        await context.Clients.AddAsync(user);
        await context.SaveChangesAsync();
    }

    public async Task<bool> ExistsAsync(Guid id)
    {
        return await context.Clients.AnyAsync(u => u.Id == id);
    }

    public async Task<User?> GetByGuidIdAsync(Guid id)
    {
        return await context.Clients.FirstOrDefaultAsync(u => u.Id == id);
    }

    // Single conditional UPDATE, so concurrent debits cannot push the balance below zero.
    public async Task<bool> TryAdjustCoinsBalanceAsync(Guid userId, int delta)
    {
        var affected = await context.Clients
            .Where(u => u.Id == userId && u.CoinsBalance + delta >= 0)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.CoinsBalance, u => u.CoinsBalance + delta));

        return affected == 1;
    }
}
