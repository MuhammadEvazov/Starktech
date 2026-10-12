using Application.DTOs.AdminTelegramBinding;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IAdminTelegramBindingService
{
    Task<Result<PageResult<GetAdminTelegramBindingDto>>> GetAllAsync(GetAdminTelegramBindingFilterDto filter);
    Task<Result<GetAdminTelegramBindingDto>> GetByIdAsync(Guid id);
    Task<Result<InitiateLinkResponseDto>> InitiateLinkAsync(InitiateLinkDto dto);
    Task<Result<GetAdminTelegramBindingDto>> ConfirmLinkAsync(ConfirmLinkDto dto);
    Task<Result<bool>> UnlinkAsync(Guid userId);
}
