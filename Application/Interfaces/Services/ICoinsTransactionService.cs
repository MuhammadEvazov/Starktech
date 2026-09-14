using Application.DTOs.CoinsTransaction;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface ICoinsTransactionService
{
    Task<Result<PageResult<GetCoinsTransactionDto>>> GetAllAsync(GetCoinsTransactionFilterDto filter);
    Task<Result<GetCoinsTransactionDto>> GetByIdAsync(Guid id);
    Task<Result<GetCoinsTransactionDto>> EarnAsync(Guid userId, int amount, Guid? orderId, string? description);
    Task<Result<GetCoinsTransactionDto>> RedeemAsync(Guid userId, int amount, Guid? orderId, string? description);
    Task<Result<GetCoinsTransactionDto>> ManualAdjustmentAsync(ManualAdjustCoinsDto dto);
}
