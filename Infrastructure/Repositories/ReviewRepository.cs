using Application.DTOs.Review;
using Application.Interfaces.Repositories;
using Application.Result;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class ReviewRepository(AppDbContext context) : IReviewRepository
{
    public async Task<PageResult<Review>> GetAllAsync(GetReviewFilterDto filter)
    {
        var query = context.Reviews
            .Include(r => r.User)
            .Include(r => r.Product)
            .AsQueryable();

        if (filter.ProductId.HasValue)
            query = query.Where(r => r.ProductId == filter.ProductId.Value);

        if (filter.UserId.HasValue)
            query = query.Where(r => r.UserId == filter.UserId.Value);

        if (filter.IsApproved.HasValue)
            query = query.Where(r => r.IsApproved == filter.IsApproved.Value);

        if (filter.MinRating.HasValue)
            query = query.Where(r => r.Rating >= filter.MinRating.Value);

        var totalCount = await query.CountAsync();

        var reviews = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .AsNoTracking()
            .ToListAsync();

        return PageResult<Review>.Ok(reviews, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<Review?> GetByIdAsync(Guid id)
    {
        return await context.Reviews
            .Include(r => r.User)
            .Include(r => r.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task<Review> AddAsync(Review review)
    {
        await context.Reviews.AddAsync(review);
        await context.SaveChangesAsync();
        return review;
    }

    public async Task<bool> UpdateAsync(Review review)
    {
        context.Reviews.Update(review);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Review review)
    {
        context.Reviews.Remove(review);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExistsByUserAndProductAsync(Guid userId, Guid productId)
    {
        return await context.Reviews.AnyAsync(r => r.UserId == userId && r.ProductId == productId);
    }

    public async Task<(double AverageRating, int Count)> GetApprovedSummaryAsync(Guid productId)
    {
        var query = context.Reviews.Where(r => r.ProductId == productId && r.IsApproved);

        var count = await query.CountAsync();
        var average = count > 0 ? await query.AverageAsync(r => r.Rating) : 0;

        return (average, count);
    }
}
