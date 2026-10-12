using Application.DTOs.VariantAttributeOption;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class VariantAttributeOptionRepository(AppDbContext context) : IVariantAttributeOptionRepository
{
    public async Task<PageResult<VariantAttributeOption>> GetAllAsync(GetVariantAttributeOptionFilterDto filter)
    {
        var query = context.VariantAttributeOptions.AsQueryable();

        if (filter.CategoryId.HasValue)
            query = query.Where(o => o.CategoryId == filter.CategoryId.Value);

        if (!string.IsNullOrWhiteSpace(filter.AttributeKey))
            query = query.Where(o => o.AttributeKey == filter.AttributeKey);

        var totalCount = await query.CountAsync();

        var options = await query
            .OrderBy(o => o.AttributeKey)
            .ThenBy(o => o.SortOrder)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<VariantAttributeOption>.Ok(options, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<VariantAttributeOption?> GetByIdAsync(Guid id)
    {
        return await context.VariantAttributeOptions
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<List<VariantAttributeOption>> GetByCategoryIdAsync(Guid categoryId)
    {
        return await context.VariantAttributeOptions
            .Where(o => o.CategoryId == categoryId)
            .OrderBy(o => o.AttributeKey)
            .ThenBy(o => o.SortOrder)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<VariantAttributeOption> AddAsync(VariantAttributeOption option)
    {
        await context.VariantAttributeOptions.AddAsync(option);
        await context.SaveChangesAsync();
        return option;
    }

    public async Task<bool> UpdateAsync(VariantAttributeOption option)
    {
        context.VariantAttributeOptions.Update(option);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(VariantAttributeOption option)
    {
        context.VariantAttributeOptions.Remove(option);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExistsAsync(Guid categoryId, string attributeKey, string attributeValue)
    {
        return await context.VariantAttributeOptions.AnyAsync(o =>
            o.CategoryId == categoryId &&
            o.AttributeKey == attributeKey &&
            o.AttributeValue == attributeValue);
    }
}
