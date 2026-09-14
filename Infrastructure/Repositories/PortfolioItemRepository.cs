using Application.DTOs.PortfolioItem;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class PortfolioItemRepository(AppDbContext context) : IPortfolioItemRepository
{
    public async Task<PageResult<PortfolioItem>> GetAllAsync(GetPortfolioItemFilterDto filter)
    {
        var query = context.PortfolioItems
            .Include(p => p.Category)
            .AsQueryable();

        if (filter.CategoryId.HasValue)
            query = query.Where(p => p.CategoryId == filter.CategoryId.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(p => p.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(p => p.SortOrder)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<PortfolioItem>.Ok(items, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<PortfolioItem?> GetByIdAsync(Guid id)
    {
        return await context.PortfolioItems
            .Include(p => p.Category)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<PortfolioItem> AddAsync(PortfolioItem item)
    {
        await context.PortfolioItems.AddAsync(item);
        await context.SaveChangesAsync();
        return item;
    }

    public async Task<bool> UpdateAsync(PortfolioItem item)
    {
        context.PortfolioItems.Update(item);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(PortfolioItem item)
    {
        context.PortfolioItems.Remove(item);
        await context.SaveChangesAsync();
        return true;
    }
}
