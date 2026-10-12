using Application.DTOs.Order;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class OrderRepository(AppDbContext context) : IOrderRepository
{
    public async Task<PageResult<Order>> GetAllAsync(GetOrderFilterDto filter)
    {
        var query = context.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.ProductVariant)
                    .ThenInclude(v => v.Product)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.OrderNumber))
        {
            var orderNumber = filter.OrderNumber.Trim().ToLower();
            query = query.Where(o => o.OrderNumber.ToLower().Contains(orderNumber));
        }

        if (filter.UserId.HasValue)
            query = query.Where(o => o.UserId == filter.UserId.Value);

        if (filter.Status.HasValue)
            query = query.Where(o => o.Status == filter.Status.Value);

        if (filter.PaymentStatus.HasValue)
            query = query.Where(o => o.PaymentStatus == filter.PaymentStatus.Value);

        if (filter.CreatedFrom.HasValue)
        {
            var fromDate = DateTime.SpecifyKind(filter.CreatedFrom.Value, DateTimeKind.Utc);
            query = query.Where(o => o.CreatedAt >= fromDate);
        }

        if (filter.CreatedTo.HasValue)
        {
            var toDate = DateTime.SpecifyKind(filter.CreatedTo.Value.AddDays(1), DateTimeKind.Utc);
            query = query.Where(o => o.CreatedAt < toDate);
        }

        var totalCount = await query.CountAsync();

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<Order>.Ok(orders, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<Order?> GetByIdAsync(Guid id)
    {
        return await context.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.ProductVariant)
                    .ThenInclude(v => v.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<Order?> GetByIdTrackedAsync(Guid id)
    {
        return await context.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.ProductVariant)
                    .ThenInclude(v => v.Product)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<Order> AddAsync(Order order)
    {
        await context.Orders.AddAsync(order);
        await context.SaveChangesAsync();
        return order;
    }

    public async Task<bool> UpdateAsync(Order order)
    {
        order.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IsOrderNumberTakenAsync(string orderNumber)
    {
        return await context.Orders.AnyAsync(o => o.OrderNumber == orderNumber);
    }

    public async Task<bool> HasDeliveredOrderForProductAsync(Guid userId, Guid productId)
    {
        return await context.Orders.AnyAsync(o =>
            o.UserId == userId &&
            o.Status == OrderStatus.Delivered &&
            o.Items.Any(i => i.ProductVariant.ProductId == productId));
    }

    // Row lock held until the surrounding transaction ends; must run before the order is loaded.
    public async Task LockForUpdateAsync(Guid id)
    {
        if (context.Database.CurrentTransaction == null)
            throw new InvalidOperationException("LockForUpdateAsync must be called inside a transaction.");

        await context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT 1 FROM \"Orders\" WHERE \"Id\" = {id} FOR UPDATE");
    }
}
