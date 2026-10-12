using Application.DTOs.VariantAttributeOption;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IVariantAttributeOptionRepository
{
    Task<PageResult<VariantAttributeOption>> GetAllAsync(GetVariantAttributeOptionFilterDto filter);
    Task<VariantAttributeOption?> GetByIdAsync(Guid id);
    Task<List<VariantAttributeOption>> GetByCategoryIdAsync(Guid categoryId);
    Task<VariantAttributeOption> AddAsync(VariantAttributeOption option);
    Task<bool> UpdateAsync(VariantAttributeOption option);
    Task<bool> DeleteAsync(VariantAttributeOption option);
    Task<bool> ExistsAsync(Guid categoryId, string attributeKey, string attributeValue);
}
