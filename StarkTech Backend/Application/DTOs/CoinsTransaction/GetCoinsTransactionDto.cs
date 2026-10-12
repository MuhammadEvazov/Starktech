using Domain.Enums;

namespace Application.DTOs.CoinsTransaction;

public class GetCoinsTransactionDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? UserFullName { get; set; }
    public Guid? OrderId { get; set; }
    public int Amount { get; set; }
    public CoinTransactionType Type { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}
