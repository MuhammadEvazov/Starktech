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
}
