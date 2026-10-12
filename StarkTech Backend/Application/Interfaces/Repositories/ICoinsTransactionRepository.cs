using Application.DTOs.CoinsTransaction;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface ICoinsTransactionRepository
{
    Task<PageResult<CoinsTransaction>> GetAllAsync(GetCoinsTransactionFilterDto filter);
    Task<CoinsTransaction?> GetByIdAsync(Guid id);
    Task<CoinsTransaction> AddAsync(CoinsTransaction transaction);
}
