using Application.DTOs.DeliveryCity;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class DeliveryCityRepository(AppDbContext context) : IDeliveryCityRepository
{
    public async Task<PageResult<DeliveryCity>> GetAllAsync(GetDeliveryCityFilterDto filter)
    {
        var query = context.DeliveryCities.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            var name = filter.Name.Trim().ToLower();
            query = query.Where(c =>
                c.NameRu.ToLower().Contains(name) ||
                c.NameTj.ToLower().Contains(name) ||
                c.NameEn.ToLower().Contains(name));
        }

        if (filter.IsActive.HasValue)
            query = query.Where(c => c.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync();

        var cities = await query
            .OrderBy(c => c.NameEn)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<DeliveryCity>.Ok(cities, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<DeliveryCity?> GetByIdAsync(Guid id)
    {
        return await context.DeliveryCities
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<DeliveryCity> AddAsync(DeliveryCity city)
    {
        await context.DeliveryCities.AddAsync(city);
        await context.SaveChangesAsync();
        return city;
    }

    public async Task<bool> UpdateAsync(DeliveryCity city)
    {
        context.DeliveryCities.Update(city);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(DeliveryCity city)
    {
        context.DeliveryCities.Remove(city);
        await context.SaveChangesAsync();
        return true;
    }
}
