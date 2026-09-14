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
    private readonly ILogger<CoinsTransactionService> _logger;

    public CoinsTransactionService(
        ICoinsTransactionRepository transactionRepository,
        IUserRepository userRepository,
        ILogger<CoinsTransactionService> logger)
    {
        _transactionRepository = transactionRepository;
        _userRepository = userRepository;
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

    public async Task<Result<GetCoinsTransactionDto>> EarnAsync(Guid userId, int amount, Guid? orderId, string? description)
    {
        if (amount <= 0)
            return Result<GetCoinsTransactionDto>.Fail("Amount must be greater than zero", ErrorType.Validation);

        var user = await _userRepository.GetByGuidIdAsync(userId);
        if (user == null)
            return Result<GetCoinsTransactionDto>.Fail("User not found", ErrorType.NotFound);

        user.CoinsBalance += amount;
        await _userRepository.UpdateAsync(user);

        var transaction = new CoinsTransaction
        {
            UserId = userId,
            OrderId = orderId,
            Amount = amount,
            Type = CoinTransactionType.Earned,
            Description = description
        };

        await _transactionRepository.AddAsync(transaction);

        _logger.LogInformation("User {UserId} earned {Amount} coins", userId, amount);

        return Result<GetCoinsTransactionDto>.Ok(ToDto(transaction));
    }

    public async Task<Result<GetCoinsTransactionDto>> RedeemAsync(Guid userId, int amount, Guid? orderId, string? description)
    {
        if (amount <= 0)
            return Result<GetCoinsTransactionDto>.Fail("Amount must be greater than zero", ErrorType.Validation);

        var user = await _userRepository.GetByGuidIdAsync(userId);
        if (user == null)
            return Result<GetCoinsTransactionDto>.Fail("User not found", ErrorType.NotFound);

        if (user.CoinsBalance < amount)
            return Result<GetCoinsTransactionDto>.Fail("Insufficient coins balance", ErrorType.Validation);

        user.CoinsBalance -= amount;
        await _userRepository.UpdateAsync(user);

        var transaction = new CoinsTransaction
        {
            UserId = userId,
            OrderId = orderId,
            Amount = -amount,
            Type = CoinTransactionType.Redeemed,
            Description = description
        };

        await _transactionRepository.AddAsync(transaction);

        _logger.LogInformation("User {UserId} redeemed {Amount} coins", userId, amount);

        return Result<GetCoinsTransactionDto>.Ok(ToDto(transaction));
    }

    public async Task<Result<GetCoinsTransactionDto>> ManualAdjustmentAsync(ManualAdjustCoinsDto dto)
    {
        if (dto.Amount == 0)
            return Result<GetCoinsTransactionDto>.Fail("Amount cannot be zero", ErrorType.Validation);

        var user = await _userRepository.GetByGuidIdAsync(dto.UserId);
        if (user == null)
            return Result<GetCoinsTransactionDto>.Fail("User not found", ErrorType.NotFound);

        var newBalance = user.CoinsBalance + dto.Amount;
        if (newBalance < 0)
            return Result<GetCoinsTransactionDto>.Fail("Resulting balance cannot be negative", ErrorType.Validation);

        user.CoinsBalance = newBalance;
        await _userRepository.UpdateAsync(user);

        var transaction = new CoinsTransaction
        {
            UserId = dto.UserId,
            Amount = dto.Amount,
            Type = CoinTransactionType.ManualAdjustment,
            Description = dto.Description
        };

        await _transactionRepository.AddAsync(transaction);

        _logger.LogInformation("Manual coins adjustment of {Amount} for user {UserId}", dto.Amount, dto.UserId);

        return Result<GetCoinsTransactionDto>.Ok(ToDto(transaction));
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
