using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class OrderItemPhotoRepository(AppDbContext context) : IOrderItemPhotoRepository
{
    public async Task<OrderItemPhoto?> GetByIdAsync(Guid id)
    {
        return await context.OrderItemPhotos
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<List<OrderItemPhoto>> GetByOrderItemIdAsync(Guid orderItemId, bool includeDeleted = false)
    {
        var query = context.OrderItemPhotos
            .Where(p => p.OrderItemId == orderItemId);

        if (!includeDeleted)
            query = query.Where(p => !p.IsDeleted);

        return await query
            .OrderBy(p => p.CreatedAt)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<OrderItemPhoto> AddAsync(OrderItemPhoto photo)
    {
        await context.OrderItemPhotos.AddAsync(photo);
        await context.SaveChangesAsync();
        return photo;
    }

    public async Task<bool> UpdateAsync(OrderItemPhoto photo)
    {
        context.OrderItemPhotos.Update(photo);
        await context.SaveChangesAsync();
        return true;
    }
}
