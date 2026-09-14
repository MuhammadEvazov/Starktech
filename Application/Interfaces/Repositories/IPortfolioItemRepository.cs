using Application.DTOs.PortfolioItem;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IPortfolioItemRepository
{
    Task<PageResult<PortfolioItem>> GetAllAsync(GetPortfolioItemFilterDto filter);
    Task<PortfolioItem?> GetByIdAsync(Guid id);
    Task<PortfolioItem> AddAsync(PortfolioItem item);
    Task<bool> UpdateAsync(PortfolioItem item);
    Task<bool> DeleteAsync(PortfolioItem item);
}
