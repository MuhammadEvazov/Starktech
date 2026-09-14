using Application.DTOs.Review;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class ReviewService : IReviewService
{
    private readonly IReviewRepository _reviewRepository;
    private readonly IProductRepository _productRepository;
    private readonly IUserRepository _userRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(
        IReviewRepository reviewRepository,
        IProductRepository productRepository,
        IUserRepository userRepository,
        IOrderRepository orderRepository,
        ILogger<ReviewService> logger)
    {
        _reviewRepository = reviewRepository;
        _productRepository = productRepository;
        _userRepository = userRepository;
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetReviewDto>>> GetAllAsync(GetReviewFilterDto filter)
    {
        var reviews = await _reviewRepository.GetAllAsync(filter);

        var items = reviews.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetReviewDto>(
            items,
            reviews.TotalCount,
            reviews.Page,
            reviews.PageSize);

        return Result<PageResult<GetReviewDto>>.Ok(pageResult);
    }

    public async Task<Result<GetReviewDto>> GetByIdAsync(Guid id)
    {
        var review = await _reviewRepository.GetByIdAsync(id);
        if (review == null)
            return Result<GetReviewDto>.Fail("Review not found", ErrorType.NotFound);

        return Result<GetReviewDto>.Ok(ToDto(review));
    }

    public async Task<Result<CreateReviewResponseDto>> CreateAsync(CreateReviewDto dto)
    {
        if (dto.Rating is < 1 or > 5)
            return Result<CreateReviewResponseDto>.Fail("Rating must be between 1 and 5", ErrorType.Validation);

        if (!await _userRepository.ExistsAsync(dto.UserId))
            return Result<CreateReviewResponseDto>.Fail("User not found", ErrorType.NotFound);

        var product = await _productRepository.GetByIdAsync(dto.ProductId);
        if (product == null)
            return Result<CreateReviewResponseDto>.Fail("Product not found", ErrorType.NotFound);

        if (await _reviewRepository.ExistsByUserAndProductAsync(dto.UserId, dto.ProductId))
            return Result<CreateReviewResponseDto>.Fail("You have already reviewed this product", ErrorType.Conflict);

        if (!await _orderRepository.HasDeliveredOrderForProductAsync(dto.UserId, dto.ProductId))
            return Result<CreateReviewResponseDto>.Fail("You can only review products from a delivered order", ErrorType.Validation);

        var review = new Review
        {
            UserId = dto.UserId,
            ProductId = dto.ProductId,
            OrderId = dto.OrderId,
            Rating = dto.Rating,
            Comment = dto.Comment,
            IsApproved = false
        };

        await _reviewRepository.AddAsync(review);

        _logger.LogInformation("Review created with ID: {Id} for product {ProductId}", review.Id, review.ProductId);

        return Result<CreateReviewResponseDto>.Ok(new CreateReviewResponseDto
        {
            Id = review.Id,
            ProductId = dto.ProductId,
            Rating = review.Rating,
            IsApproved = review.IsApproved
        });
    }

    public async Task<Result<GetReviewDto>> ApproveAsync(Guid id)
    {
        var review = await _reviewRepository.GetByIdAsync(id);
        if (review == null)
            return Result<GetReviewDto>.Fail("Review not found", ErrorType.NotFound);

        if (!review.IsApproved)
        {
            review.IsApproved = true;
            await _reviewRepository.UpdateAsync(review);
        }

        return Result<GetReviewDto>.Ok(ToDto(review));
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var review = await _reviewRepository.GetByIdAsync(id);
        if (review == null)
            return Result<bool>.Fail("Review not found", ErrorType.NotFound);

        await _reviewRepository.DeleteAsync(review);

        return Result<bool>.Ok(true);
    }

    public async Task<Result<ProductRatingSummaryDto>> GetProductRatingSummaryAsync(Guid productId)
    {
        var product = await _productRepository.GetByIdAsync(productId);
        if (product == null)
            return Result<ProductRatingSummaryDto>.Fail("Product not found", ErrorType.NotFound);

        var (average, count) = await _reviewRepository.GetApprovedSummaryAsync(productId);

        return Result<ProductRatingSummaryDto>.Ok(new ProductRatingSummaryDto
        {
            ProductId = productId,
            AverageRating = Math.Round(average, 2),
            ReviewCount = count
        });
    }

    private static GetReviewDto ToDto(Review review) => new()
    {
        Id = review.Id,
        UserId = review.UserId,
        UserFullName = review.User?.FullName,
        ProductId = review.ProductId,
        ProductNameEn = review.Product?.NameEn,
        OrderId = review.OrderId,
        Rating = review.Rating,
        Comment = review.Comment,
        IsApproved = review.IsApproved,
        CreatedAt = review.CreatedAt
    };
}
