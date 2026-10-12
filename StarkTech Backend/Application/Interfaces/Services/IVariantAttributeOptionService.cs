using Application.DTOs.VariantAttributeOption;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IVariantAttributeOptionService
{
    Task<Result<PageResult<GetVariantAttributeOptionDto>>> GetAllAsync(GetVariantAttributeOptionFilterDto filter);
    Task<Result<GetVariantAttributeOptionDto>> GetByIdAsync(Guid id);
    Task<Result<Dictionary<string, List<GetVariantAttributeOptionDto>>>> GetGroupedByCategoryAsync(Guid categoryId);
    Task<Result<CreateVariantAttributeOptionResponseDto>> CreateAsync(CreateVariantAttributeOptionDto dto);
    Task<Result<UpdateVariantAttributeOptionResponseDto>> UpdateAsync(Guid id, UpdateVariantAttributeOptionDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
}
