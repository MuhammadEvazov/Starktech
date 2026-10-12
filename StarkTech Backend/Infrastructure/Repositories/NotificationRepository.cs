using Application.DTOs.Notification;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class NotificationRepository(AppDbContext context) : INotificationRepository
{
    public async Task<PageResult<Notification>> GetAllAsync(GetNotificationFilterDto filter)
    {
        var query = context.Notifications
            .Include(n => n.Order)
            .AsQueryable();

        if (filter.OrderId.HasValue)
            query = query.Where(n => n.OrderId == filter.OrderId.Value);

        if (filter.Channel.HasValue)
            query = query.Where(n => n.Channel == filter.Channel.Value);

        if (filter.Status.HasValue)
            query = query.Where(n => n.Status == filter.Status.Value);

        var totalCount = await query.CountAsync();

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<Notification>.Ok(notifications, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<Notification?> GetByIdAsync(Guid id)
    {
        return await context.Notifications
            .Include(n => n.Order)
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id);
    }

    public async Task<Notification> AddAsync(Notification notification)
    {
        await context.Notifications.AddAsync(notification);
        await context.SaveChangesAsync();
        return notification;
    }
}
