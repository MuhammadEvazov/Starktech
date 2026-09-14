using Application.DTOs.Review;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IReviewRepository
{
    Task<PageResult<Review>> GetAllAsync(GetReviewFilterDto filter);
    Task<Review?> GetByIdAsync(Guid id);
    Task<Review> AddAsync(Review review);
    Task<bool> UpdateAsync(Review review);
    Task<bool> DeleteAsync(Review review);
    Task<bool> ExistsByUserAndProductAsync(Guid userId, Guid productId);
    Task<(double AverageRating, int Count)> GetApprovedSummaryAsync(Guid productId);
}
