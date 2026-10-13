namespace Application.DTOs.Review;

public class GetReviewDto
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? UserFullName { get; set; }
    public Guid? ProductId { get; set; }
    public string? ProductNameRu { get; set; }
    public string? ProductNameEn { get; set; }
    public Guid? OrderId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public bool IsApproved { get; set; }
    public DateTime CreatedAt { get; set; }
}
