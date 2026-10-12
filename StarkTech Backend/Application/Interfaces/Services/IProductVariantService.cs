using Application.DTOs.ProductVariant;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IProductVariantService
{
    Task<Result<PageResult<GetProductVariantDto>>> GetAllAsync(GetProductVariantFilterDto filter);
    Task<Result<GetProductVariantDto>> GetByIdAsync(Guid id);
    Task<Result<CreateProductVariantResponseDto>> CreateAsync(CreateProductVariantDto dto);
    Task<Result<UpdateProductVariantResponseDto>> UpdateAsync(Guid id, UpdateProductVariantDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
    Task<Result<GetProductVariantDto>> RestoreAsync(Guid id);
    Task<Result<GetProductVariantDto>> UploadImageAsync(Guid id, IFormFile file);
    Task<Result<GetProductVariantDto>> DeleteImageAsync(Guid id);
}
