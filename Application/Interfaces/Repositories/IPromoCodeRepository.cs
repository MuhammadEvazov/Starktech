using Application.DTOs.PromoCode;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IPromoCodeRepository
{
    Task<PageResult<PromoCode>> GetAllAsync(GetPromoCodeFilterDto filter);
    Task<PromoCode?> GetByIdAsync(Guid id);
    Task<PromoCode> AddAsync(PromoCode promoCode);
    Task<bool> UpdateAsync(PromoCode promoCode);
    Task<bool> DeleteAsync(PromoCode promoCode);
    Task<bool> ExistsByCodeAsync(string code);
}
