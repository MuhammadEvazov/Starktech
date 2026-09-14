using Application.DTOs.PromoCode;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IPromoCodeService
{
    Task<Result<PageResult<GetPromoCodeDto>>> GetAllAsync(GetPromoCodeFilterDto filter);
    Task<Result<GetPromoCodeDto>> GetByIdAsync(Guid id);
    Task<Result<CreatePromoCodeResponseDto>> CreateAsync(CreatePromoCodeDto dto);
    Task<Result<UpdatePromoCodeResponseDto>> UpdateAsync(Guid id, UpdatePromoCodeDto dto);
    Task<Result<bool>> DeleteAsync(Guid id);
}
