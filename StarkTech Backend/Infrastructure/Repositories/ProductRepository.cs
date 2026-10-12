using Application.DTOs.Product;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class ProductRepository(AppDbContext context) : IProductRepository
{
    public async Task<PageResult<Product>> GetAllAsync(GetProductFilterDto filter)
    {
        var query = context.Products.Where(p => p.IsDeleted == filter.Deleted);

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            var name = filter.Name.Trim().ToLower();
            query = query.Where(p =>
                p.NameRu.ToLower().Contains(name) ||
                p.NameTj.ToLower().Contains(name) ||
                p.NameEn.ToLower().Contains(name));
        }

        if (filter.CategoryId.HasValue)
            query = query.Where(p => p.CategoryId == filter.CategoryId.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(p => p.IsActive == filter.IsActive.Value);

        var totalCount = await query.CountAsync();

        // Корзина — сначала недавно удалённые, каталог — по алфавиту.
        var ordered = filter.Deleted
            ? query.OrderByDescending(p => p.DeletedAt)
            : query.OrderBy(p => p.NameEn);

        var products = await ordered
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<Product>.Ok(products, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<Product?> GetByIdAsync(Guid id)
    {
        return await context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
    }

    public async Task<Product?> GetDeletedByIdAsync(Guid id)
    {
        return await context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
    }

    public async Task<bool> IsDeletedAsync(Guid id)
    {
        return await context.Products.AnyAsync(p => p.Id == id && p.IsDeleted);
    }

    public async Task<Product> AddAsync(Product product)
    {
        await context.Products.AddAsync(product);
        await context.SaveChangesAsync();
        return product;
    }

    public async Task<bool> UpdateAsync(Product product)
    {
        context.Products.Update(product);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Product product)
    {
        context.Products.Remove(product);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExistsByNameAsync(Guid categoryId, string nameEn)
    {
        // Удалённые товары не занимают название — его можно использовать снова.
        return await context.Products.AnyAsync(p =>
            !p.IsDeleted &&
            p.CategoryId == categoryId &&
            p.NameEn.ToLower() == nameEn.ToLower().Trim());
    }
}
