using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class OrderItemRepository(AppDbContext context) : IOrderItemRepository
{
    public async Task<OrderItem?> GetByIdAsync(Guid id)
    {
        return await context.OrderItems
            .Include(i => i.Order)
            .Include(i => i.ProductVariant)
                .ThenInclude(v => v.Product)
            .FirstOrDefaultAsync(i => i.Id == id);
    }

    public async Task<OrderItem> AddAsync(OrderItem item)
    {
        await context.OrderItems.AddAsync(item);
        await context.SaveChangesAsync();
        return item;
    }

    public async Task<bool> UpdateAsync(OrderItem item)
    {
        context.OrderItems.Update(item);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(OrderItem item)
    {
        context.OrderItems.Remove(item);
        await context.SaveChangesAsync();
        return true;
    }
}
