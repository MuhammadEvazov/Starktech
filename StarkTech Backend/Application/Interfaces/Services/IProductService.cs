using Application.DTOs.Product;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IProductService
{
    Task<Result<PageResult<GetProductDto>>> GetAllAsync(GetProductFilterDto filter);
    Task<Result<GetProductDto>> GetByIdAsync(Guid id);
    Task<Result<CreateProductResponseDto>> CreateAsync(CreateProductDto dto);
    Task<Result<UpdateProductResponseDto>> UpdateAsync(Guid id, UpdateProductDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
    Task<Result<GetProductDto>> RestoreAsync(Guid id);
    Task<Result<GetProductDto>> UploadImageAsync(Guid id, IFormFile file);
    Task<Result<GetProductDto>> DeleteImageAsync(Guid id);
}
