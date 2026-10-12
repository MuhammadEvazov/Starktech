namespace Application.DTOs.Review;

public class CreateReviewDto
{
    public Guid UserId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? OrderId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
}
