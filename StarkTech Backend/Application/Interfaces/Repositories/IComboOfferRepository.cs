using Application.DTOs.ComboOffer;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IComboOfferRepository
{
    Task<PageResult<ComboOffer>> GetAllAsync(GetComboOfferFilterDto filter);
    Task<ComboOffer?> GetByIdAsync(Guid id);
    Task<ComboOffer> AddAsync(ComboOffer comboOffer);
    Task<bool> UpdateAsync(ComboOffer comboOffer);
    Task<bool> DeleteAsync(ComboOffer comboOffer);
}
