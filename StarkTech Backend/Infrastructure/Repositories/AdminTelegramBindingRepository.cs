using Application.DTOs.AdminTelegramBinding;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class AdminTelegramBindingRepository(AppDbContext context) : IAdminTelegramBindingRepository
{
    public async Task<PageResult<AdminTelegramBinding>> GetAllAsync(GetAdminTelegramBindingFilterDto filter)
    {
        var query = context.AdminTelegramBindings
            .Include(b => b.User)
            .AsQueryable();

        if (filter.UserId.HasValue)
            query = query.Where(b => b.UserId == filter.UserId.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(b => b.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync();

        var bindings = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<AdminTelegramBinding>.Ok(bindings, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<AdminTelegramBinding?> GetByIdAsync(Guid id)
    {
        return await context.AdminTelegramBindings
            .Include(b => b.User)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id);
    }

    public async Task<AdminTelegramBinding?> GetByUserIdAsync(Guid userId)
    {
        return await context.AdminTelegramBindings
            .FirstOrDefaultAsync(b => b.UserId == userId);
    }

    public async Task<AdminTelegramBinding?> GetByChatIdAsync(string telegramChatId)
    {
        return await context.AdminTelegramBindings
            .FirstOrDefaultAsync(b => b.TelegramChatId == telegramChatId);
    }

    public async Task<AdminTelegramBinding> AddAsync(AdminTelegramBinding binding)
    {
        await context.AdminTelegramBindings.AddAsync(binding);
        await context.SaveChangesAsync();
        return binding;
    }

    public async Task<bool> UpdateAsync(AdminTelegramBinding binding)
    {
        context.AdminTelegramBindings.Update(binding);
        await context.SaveChangesAsync();
        return true;
    }
}
