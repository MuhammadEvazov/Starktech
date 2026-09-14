using Application.DTOs.PromoCode;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class PromoCodeRepository(AppDbContext context) : IPromoCodeRepository
{
    public async Task<PageResult<PromoCode>> GetAllAsync(GetPromoCodeFilterDto filter)
    {
        var query = context.PromoCodes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Code))
        {
            var code = filter.Code.Trim().ToLower();
            query = query.Where(p => p.Code.ToLower().Contains(code));
        }

        if (filter.IsActive.HasValue)
            query = query.Where(p => p.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync();

        var promoCodes = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<PromoCode>.Ok(promoCodes, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<PromoCode?> GetByIdAsync(Guid id)
    {
        return await context.PromoCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<PromoCode> AddAsync(PromoCode promoCode)
    {
        await context.PromoCodes.AddAsync(promoCode);
        await context.SaveChangesAsync();
        return promoCode;
    }

    public async Task<bool> UpdateAsync(PromoCode promoCode)
    {
        context.PromoCodes.Update(promoCode);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(PromoCode promoCode)
    {
        context.PromoCodes.Remove(promoCode);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExistsByCodeAsync(string code)
    {
        return await context.PromoCodes.AnyAsync(p =>
            p.Code.ToLower() == code.ToLower().Trim());
    }
}
