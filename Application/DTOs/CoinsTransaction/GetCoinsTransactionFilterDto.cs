using Application.Result;
using Domain.Enums;

namespace Application.DTOs.CoinsTransaction;

public class GetCoinsTransactionFilterDto : PageRequest
{
    public Guid? UserId { get; set; }
    public Guid? OrderId { get; set; }
    public CoinTransactionType? Type { get; set; }
}
