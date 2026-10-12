using Application.DTOs.AdminTelegramBinding;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface IAdminTelegramBindingRepository
{
    Task<PageResult<AdminTelegramBinding>> GetAllAsync(GetAdminTelegramBindingFilterDto filter);
    Task<AdminTelegramBinding?> GetByIdAsync(Guid id);
    Task<AdminTelegramBinding?> GetByUserIdAsync(Guid userId);
    Task<AdminTelegramBinding?> GetByChatIdAsync(string telegramChatId);
    Task<AdminTelegramBinding> AddAsync(AdminTelegramBinding binding);
    Task<bool> UpdateAsync(AdminTelegramBinding binding);
}
