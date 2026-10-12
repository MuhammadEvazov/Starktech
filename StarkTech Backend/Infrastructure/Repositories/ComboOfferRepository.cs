using Application.DTOs.ComboOffer;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class ComboOfferRepository(AppDbContext context) : IComboOfferRepository
{
    public async Task<PageResult<ComboOffer>> GetAllAsync(GetComboOfferFilterDto filter)
    {
        var query = context.ComboOffers.AsQueryable();

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

        var comboOffers = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<ComboOffer>.Ok(comboOffers, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<ComboOffer?> GetByIdAsync(Guid id)
    {
        return await context.ComboOffers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<ComboOffer> AddAsync(ComboOffer comboOffer)
    {
        await context.ComboOffers.AddAsync(comboOffer);
        await context.SaveChangesAsync();
        return comboOffer;
    }

    public async Task<bool> UpdateAsync(ComboOffer comboOffer)
    {
        context.ComboOffers.Update(comboOffer);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(ComboOffer comboOffer)
    {
        context.ComboOffers.Remove(comboOffer);
        await context.SaveChangesAsync();
        return true;
    }
}
