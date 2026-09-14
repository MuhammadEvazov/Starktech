using Application.DTOs.Category;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface ICategoryRepository
{
    Task<PageResult<Category>> GetAllAsync(GetCategoryFilterDto filter);
    Task<Category?> GetByIdAsync(Guid id);
    Task<Category> AddAsync(Category category);
    Task<bool> UpdateAsync(Category category);
    Task<bool> DeleteAsync(Category category);
    Task<bool> ExistsBySlugAsync(string slug);
    Task<bool> HasProductsAsync(Guid categoryId);
}
