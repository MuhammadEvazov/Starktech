using Application.DTOs.Order;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public class OrderActivityService : IOrderActivityService
{
    private readonly AppDbContext _context;

    public OrderActivityService(AppDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(Guid orderId, string message, bool byClient)
    {
        _context.Add(new OrderActivity
        {
            OrderId = orderId,
            Message = message.Length > 300 ? message[..300] : message,
            ByClient = byClient,
            IsSeen = !byClient // свои действия сотруднику помечать не нужно
        });

        if (byClient)
        {
            await _context.Orders
                .Where(o => o.Id == orderId)
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.HasClientChanges, true));
        }

        await _context.SaveChangesAsync();
    }

    public async Task<Result<List<OrderActivityDto>>> GetByOrderAsync(Guid orderId)
    {
        if (!await _context.Orders.AnyAsync(o => o.Id == orderId))
            return Result<List<OrderActivityDto>>.Fail("Order not found", ErrorType.NotFound);

        var items = await _context.Set<OrderActivity>()
            .AsNoTracking()
            .Where(a => a.OrderId == orderId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new OrderActivityDto
            {
                Id = a.Id,
                Message = a.Message,
                ByClient = a.ByClient,
                IsSeen = a.IsSeen,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        return Result<List<OrderActivityDto>>.Ok(items);
    }

    public async Task<Result<bool>> MarkSeenAsync(Guid orderId)
    {
        var updated = await _context.Orders
            .Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.HasClientChanges, false));
        if (updated == 0)
            return Result<bool>.Fail("Order not found", ErrorType.NotFound);

        await _context.Set<OrderActivity>()
            .Where(a => a.OrderId == orderId && !a.IsSeen)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsSeen, true));

        return Result<bool>.Ok(true);
    }
}
