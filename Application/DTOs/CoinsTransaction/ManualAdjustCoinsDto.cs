namespace Application.DTOs.CoinsTransaction;

public class ManualAdjustCoinsDto
{
    public Guid UserId { get; set; }
    public int Amount { get; set; }
    public string? Description { get; set; }
}
