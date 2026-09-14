using Domain.Enums;

namespace Domain.Entities;

public class CoinsTransaction : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    public Guid? OrderId { get; set; }
    public Order? Order { get; set; }

    public int Amount { get; set; } // +/-
    public CoinTransactionType Type { get; set; }
    public string? Description { get; set; }
}
