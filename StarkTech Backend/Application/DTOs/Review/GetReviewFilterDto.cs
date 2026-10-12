using Application.Result;

namespace Application.DTOs.Review;

public class GetReviewFilterDto : PageRequest
{
    public Guid? ProductId { get; set; }
    public Guid? UserId { get; set; }
    public bool? IsApproved { get; set; }
    public int? MinRating { get; set; }
}
