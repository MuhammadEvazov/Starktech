using Application.DTOs.ProductVariant;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class ProductVariantRepository(AppDbContext context) : IProductVariantRepository
{
    public async Task<PageResult<ProductVariant>> GetAllAsync(GetProductVariantFilterDto filter)
    {
        var query = context.ProductVariants.Where(v => v.IsDeleted == filter.Deleted);

        if (filter.ProductId.HasValue)
            query = query.Where(v => v.ProductId == filter.ProductId.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(v => v.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync();

        var ordered = filter.Deleted
            ? query.OrderByDescending(v => v.DeletedAt)
            : query.OrderBy(v => v.CreatedAt);

        var variants = await ordered
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<ProductVariant>.Ok(variants, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<ProductVariant?> GetByIdAsync(Guid id)
    {
        return await context.ProductVariants
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id && !v.IsDeleted);
    }

    public async Task<ProductVariant?> GetDeletedByIdAsync(Guid id)
    {
        return await context.ProductVariants
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id && v.IsDeleted);
    }

    public async Task<ProductVariant> AddAsync(ProductVariant variant)
    {
        await context.ProductVariants.AddAsync(variant);
        await context.SaveChangesAsync();
        return variant;
    }

    public async Task<bool> UpdateAsync(ProductVariant variant)
    {
        context.ProductVariants.Update(variant);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(ProductVariant variant)
    {
        context.ProductVariants.Remove(variant);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> HasOrderItemsAsync(Guid variantId)
    {
        return await context.OrderItems.AnyAsync(oi => oi.ProductVariantId == variantId);
    }
}
