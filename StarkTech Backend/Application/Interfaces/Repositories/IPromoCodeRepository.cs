using Application.DTOs.PromoCode;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IPromoCodeRepository
{
    Task<PageResult<PromoCode>> GetAllAsync(GetPromoCodeFilterDto filter);
    Task<PromoCode?> GetByIdAsync(Guid id);
    /// <summary>Поиск без учёта регистра и пробелов по краям.</summary>
    Task<PromoCode?> GetByCodeAsync(string code);
    Task<PromoCode> AddAsync(PromoCode promoCode);
    Task<bool> UpdateAsync(PromoCode promoCode);
    Task<bool> DeleteAsync(PromoCode promoCode);
    /// <summary>Есть ли код (без учёта регистра); excludeId — не считать сам редактируемый промокод.</summary>
    Task<bool> ExistsByCodeAsync(string code, Guid? excludeId = null);
    /// <summary>Сколько неотменённых заказов клиента (профиль User.Id) оформлено с этим промокодом.</summary>
    Task<int> CountUserUsagesAsync(Guid promoCodeId, Guid userProfileId);
    Task<bool> TryIncrementUsageAsync(Guid id);
    Task DecrementUsageAsync(Guid id);
}
