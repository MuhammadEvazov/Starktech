using Application.DTOs.Review;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewController : BaseController
{
    private readonly IReviewService _reviewService;

    public ReviewController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetReviewFilterDto filter)
    {
        var result = await _reviewService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _reviewService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(CreateReviewDto dto)
    {
        // The author is always taken from the token, never from the request body.
        var profileId = await GetCurrentProfileIdAsync();

        if (profileId == null)
            return Unauthorized(Result<string>.Fail("User profile not found", ErrorType.Unauthorized));

        dto.UserId = profileId.Value;

        var result = await _reviewService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPost("{id}/approve")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ReviewsModerate)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var result = await _reviewService.ApproveAsync(id);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.ReviewsModerate)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _reviewService.DeleteAsync(id);
        return HandleResult(result);
    }

    [HttpGet("product/{productId}/summary")]
    public async Task<IActionResult> GetProductRatingSummary(Guid productId)
    {
        var result = await _reviewService.GetProductRatingSummaryAsync(productId);
        return HandleResult(result);
    }
}
