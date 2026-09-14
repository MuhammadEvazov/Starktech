using Application.DTOs.Category;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class CategoryRepository(AppDbContext context) : ICategoryRepository
{
    public async Task<PageResult<Category>> GetAllAsync(GetCategoryFilterDto filter)
    {
        var query = context.Categories.AsQueryable();

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

        var categories = await query
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.NameEn)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<Category>.Ok(categories, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<Category?> GetByIdAsync(Guid id)
    {
        return await context.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<Category> AddAsync(Category category)
    {
        await context.Categories.AddAsync(category);
        await context.SaveChangesAsync();
        return category;
    }

    public async Task<bool> UpdateAsync(Category category)
    {
        context.Categories.Update(category);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Category category)
    {
        context.Categories.Remove(category);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExistsBySlugAsync(string slug)
    {
        return await context.Categories.AnyAsync(c =>
            c.Slug.ToLower() == slug.ToLower().Trim());
    }

    public async Task<bool> HasProductsAsync(Guid categoryId)
    {
        return await context.Products.AnyAsync(p => p.CategoryId == categoryId);
    }
}
