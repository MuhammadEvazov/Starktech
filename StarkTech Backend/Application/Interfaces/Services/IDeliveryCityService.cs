using Application.DTOs.DeliveryCity;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IDeliveryCityService
{
    Task<Result<PageResult<GetDeliveryCityDto>>> GetAllAsync(GetDeliveryCityFilterDto filter);
    Task<Result<GetDeliveryCityDto>> GetByIdAsync(Guid id);
    Task<Result<CreateDeliveryCityResponseDto>> CreateAsync(CreateDeliveryCityDto dto);
    Task<Result<UpdateDeliveryCityResponseDto>> UpdateAsync(Guid id, UpdateDeliveryCityDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
}
