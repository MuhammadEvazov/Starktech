using Application.DTOs.Product;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IProductRepository
{
    Task<PageResult<Product>> GetAllAsync(GetProductFilterDto filter);
    Task<Product?> GetByIdAsync(Guid id);
    Task<Product?> GetDeletedByIdAsync(Guid id);
    Task<bool> IsDeletedAsync(Guid id);
    Task<Product> AddAsync(Product product);
    Task<bool> UpdateAsync(Product product);
    Task<bool> DeleteAsync(Product product);
    Task<bool> ExistsByNameAsync(Guid categoryId, string nameEn);
}
