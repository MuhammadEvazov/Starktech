using Application.DTOs.PortfolioItem;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IPortfolioItemService
{
    Task<Result<PageResult<GetPortfolioItemDto>>> GetAllAsync(GetPortfolioItemFilterDto filter);
    Task<Result<GetPortfolioItemDto>> GetByIdAsync(Guid id);
    Task<Result<CreatePortfolioItemResponseDto>> CreateAsync(CreatePortfolioItemDto dto);
    Task<Result<CreatePortfolioItemResponseDto>> CreateWithImageAsync(CreatePortfolioItemWithImageDto dto);
    Task<Result<UpdatePortfolioItemResponseDto>> UpdateAsync(Guid id, UpdatePortfolioItemDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
    Task<Result<GetPortfolioItemDto>> UploadImageAsync(Guid id, IFormFile file);
}
