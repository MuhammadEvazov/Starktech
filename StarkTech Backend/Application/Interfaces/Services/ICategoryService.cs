using Application.DTOs.Category;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface ICategoryService
{
    Task<Result<PageResult<GetCategoryDto>>> GetAllAsync(GetCategoryFilterDto filter);
    Task<Result<GetCategoryDto>> GetByIdAsync(Guid id);
    Task<Result<CreateCategoryResponseDto>> CreateAsync(CreateCategoryDto dto);
    Task<Result<UpdateCategoryResponseDto>> UpdateAsync(Guid id, UpdateCategoryDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
    Task<Result<GetCategoryDto>> UploadImageAsync(Guid id, IFormFile file);
    Task<Result<GetCategoryDto>> DeleteImageAsync(Guid id);
}
