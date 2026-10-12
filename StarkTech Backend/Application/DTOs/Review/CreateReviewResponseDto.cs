namespace Application.DTOs.Review;

public class CreateReviewResponseDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public int Rating { get; set; }
    public bool IsApproved { get; set; }
}
