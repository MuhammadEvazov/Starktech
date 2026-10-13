using Application.DTOs.CoinsTransaction;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class CoinsTransactionService : ICoinsTransactionService
{
    private readonly ICoinsTransactionRepository _transactionRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CoinsTransactionService> _logger;

    public CoinsTransactionService(
        ICoinsTransactionRepository transactionRepository,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        ILogger<CoinsTransactionService> logger)
    {
        _transactionRepository = transactionRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetCoinsTransactionDto>>> GetAllAsync(GetCoinsTransactionFilterDto filter)
    {
        var transactions = await _transactionRepository.GetAllAsync(filter);

        var items = transactions.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetCoinsTransactionDto>(
            items,
            transactions.TotalCount,
            transactions.Page,
            transactions.PageSize);

        return Result<PageResult<GetCoinsTransactionDto>>.Ok(pageResult);
    }

    public async Task<Result<GetCoinsTransactionDto>> GetByIdAsync(Guid id)
    {
        var transaction = await _transactionRepository.GetByIdAsync(id);
        if (transaction == null)
            return Result<GetCoinsTransactionDto>.Fail("Coins transaction not found", ErrorType.NotFound);

        return Result<GetCoinsTransactionDto>.Ok(ToDto(transaction));
    }

    public Task<Result<GetCoinsTransactionDto>> EarnAsync(Guid userId, int amount, Guid? orderId, string? description)
    {
        if (amount <= 0)
            return Task.FromResult(Result<GetCoinsTransactionDto>.Fail("Amount must be greater than zero", ErrorType.Validation));

        return ChangeBalanceAsync(userId, amount, CoinTransactionType.Earned, orderId, description, "Insufficient coins balance");
    }

    public Task<Result<GetCoinsTransactionDto>> RedeemAsync(Guid userId, int amount, Guid? orderId, string? description)
    {
        if (amount <= 0)
            return Task.FromResult(Result<GetCoinsTransactionDto>.Fail("Amount must be greater than zero", ErrorType.Validation));

        return ChangeBalanceAsync(userId, -amount, CoinTransactionType.Redeemed, orderId, description, "Insufficient coins balance");
    }

    public Task<Result<GetCoinsTransactionDto>> RefundAsync(Guid userId, int amount, Guid? orderId, string? description)
    {
        if (amount <= 0)
            return Task.FromResult(Result<GetCoinsTransactionDto>.Fail("Amount must be greater than zero", ErrorType.Validation));

        return ChangeBalanceAsync(userId, amount, CoinTransactionType.Refunded, orderId, description, "Insufficient coins balance");
    }

    public Task<Result<GetCoinsTransactionDto>> ManualAdjustmentAsync(ManualAdjustCoinsDto dto)
    {
        if (dto.Amount == 0)
            return Task.FromResult(Result<GetCoinsTransactionDto>.Fail("Amount cannot be zero", ErrorType.Validation));

        return ChangeBalanceAsync(dto.UserId, dto.Amount, CoinTransactionType.ManualAdjustment, null, dto.Description, "Resulting balance cannot be negative");
    }

    // Balance change and ledger entry are saved together, or not at all.
    private Task<Result<GetCoinsTransactionDto>> ChangeBalanceAsync(
        Guid userId,
        int delta,
        CoinTransactionType type,
        Guid? orderId,
        string? description,
        string insufficientBalanceMessage)
    {
        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            if (!await _userRepository.ExistsAsync(userId))
                return Result<GetCoinsTransactionDto>.Fail("User not found", ErrorType.NotFound);

            if (!await _userRepository.TryAdjustCoinsBalanceAsync(userId, delta))
                return Result<GetCoinsTransactionDto>.Fail(insufficientBalanceMessage, ErrorType.Validation);

            var transaction = new CoinsTransaction
            {
                UserId = userId,
                OrderId = orderId,
                Amount = delta,
                Type = type,
                Description = description
            };

            await _transactionRepository.AddAsync(transaction);

            _logger.LogInformation("Coins balance of user {UserId} changed by {Delta} ({Type})", userId, delta, type);

            return Result<GetCoinsTransactionDto>.Ok(ToDto(transaction));
        });
    }

    private static GetCoinsTransactionDto ToDto(CoinsTransaction transaction) => new()
    {
        Id = transaction.Id,
        UserId = transaction.UserId,
        UserFullName = transaction.User?.FullName,
        OrderId = transaction.OrderId,
        Amount = transaction.Amount,
        Type = transaction.Type,
        Description = transaction.Description,
        CreatedAt = transaction.CreatedAt
    };
}
