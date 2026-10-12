using Application.DTOs.CoinsTransaction;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class CoinsTransactionRepository(AppDbContext context) : ICoinsTransactionRepository
{
    public async Task<PageResult<CoinsTransaction>> GetAllAsync(GetCoinsTransactionFilterDto filter)
    {
        var query = context.CoinsTransactions
            .Include(t => t.User)
            .AsQueryable();

        if (filter.UserId.HasValue)
            query = query.Where(t => t.UserId == filter.UserId.Value);

        if (filter.OrderId.HasValue)
            query = query.Where(t => t.OrderId == filter.OrderId.Value);

        if (filter.Type.HasValue)
            query = query.Where(t => t.Type == filter.Type.Value);

        var totalCount = await query.CountAsync();

        var transactions = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<CoinsTransaction>.Ok(transactions, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<CoinsTransaction?> GetByIdAsync(Guid id)
    {
        return await context.CoinsTransactions
            .Include(t => t.User)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<CoinsTransaction> AddAsync(CoinsTransaction transaction)
    {
        await context.CoinsTransactions.AddAsync(transaction);
        await context.SaveChangesAsync();
        return transaction;
    }
}
