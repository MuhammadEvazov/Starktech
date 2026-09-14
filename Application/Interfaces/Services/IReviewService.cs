using Application.DTOs.Review;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IReviewService
{
    Task<Result<PageResult<GetReviewDto>>> GetAllAsync(GetReviewFilterDto filter);
    Task<Result<GetReviewDto>> GetByIdAsync(Guid id);
    Task<Result<CreateReviewResponseDto>> CreateAsync(CreateReviewDto dto);
    Task<Result<GetReviewDto>> ApproveAsync(Guid id);
    Task<Result<bool>> DeleteAsync(Guid id);
    Task<Result<ProductRatingSummaryDto>> GetProductRatingSummaryAsync(Guid productId);
}
