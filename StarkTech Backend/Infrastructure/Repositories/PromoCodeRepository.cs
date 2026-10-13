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
        // UsedCount changes only through the atomic usage methods; never overwrite it with a stale value.
        context.Entry(promoCode).Property(p => p.UsedCount).IsModified = false;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(PromoCode promoCode)
    {
        context.PromoCodes.Remove(promoCode);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<PromoCode?> GetByCodeAsync(string code)
    {
        var normalized = (code ?? string.Empty).Trim().ToUpper();
        if (normalized.Length == 0)
            return null;

        return await context.PromoCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Code.ToUpper() == normalized);
    }

    public async Task<bool> ExistsByCodeAsync(string code, Guid? excludeId = null)
    {
        var normalized = (code ?? string.Empty).Trim().ToUpper();

        return await context.PromoCodes.AnyAsync(p =>
            p.Code.ToUpper() == normalized && (excludeId == null || p.Id != excludeId));
    }

    public async Task<int> CountUserUsagesAsync(Guid promoCodeId, Guid userProfileId)
    {
        return await context.Orders.CountAsync(o =>
            o.PromoCodeId == promoCodeId &&
            o.UserId == userProfileId &&
            o.Status != Domain.Enums.OrderStatus.Cancelled);
    }

    // Single conditional UPDATE, so concurrent orders cannot exceed MaxUsages.
    public async Task<bool> TryIncrementUsageAsync(Guid id)
    {
        var affected = await context.PromoCodes
            .Where(p => p.Id == id && (p.MaxUsages == null || p.UsedCount < p.MaxUsages))
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.UsedCount, p => p.UsedCount + 1));

        return affected == 1;
    }

    public async Task DecrementUsageAsync(Guid id)
    {
        await context.PromoCodes
            .Where(p => p.Id == id && p.UsedCount > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.UsedCount, p => p.UsedCount - 1));
    }
}
