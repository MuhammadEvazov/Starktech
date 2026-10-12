using Application.DTOs.DeliveryCity;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IDeliveryCityRepository
{
    Task<PageResult<DeliveryCity>> GetAllAsync(GetDeliveryCityFilterDto filter);
    Task<DeliveryCity?> GetByIdAsync(Guid id);
    Task<DeliveryCity> AddAsync(DeliveryCity city);
    Task<bool> UpdateAsync(DeliveryCity city);
    Task<bool> DeleteAsync(DeliveryCity city);
}
