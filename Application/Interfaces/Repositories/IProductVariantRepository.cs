using Application.DTOs.ProductVariant;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IProductVariantRepository
{
    Task<PageResult<ProductVariant>> GetAllAsync(GetProductVariantFilterDto filter);
    Task<ProductVariant?> GetByIdAsync(Guid id);
    Task<ProductVariant> AddAsync(ProductVariant variant);
    Task<bool> UpdateAsync(ProductVariant variant);
    Task<bool> DeleteAsync(ProductVariant variant);
    Task<bool> HasOrderItemsAsync(Guid variantId);
}
