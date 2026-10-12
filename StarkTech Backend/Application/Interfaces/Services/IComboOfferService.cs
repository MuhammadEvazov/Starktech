using Application.DTOs.ComboOffer;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IComboOfferService
{
    Task<Result<PageResult<GetComboOfferDto>>> GetAllAsync(GetComboOfferFilterDto filter);
    Task<Result<GetComboOfferDto>> GetByIdAsync(Guid id);
    Task<Result<CreateComboOfferResponseDto>> CreateAsync(CreateComboOfferDto dto);
    Task<Result<UpdateComboOfferResponseDto>> UpdateAsync(Guid id, UpdateComboOfferDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
}
