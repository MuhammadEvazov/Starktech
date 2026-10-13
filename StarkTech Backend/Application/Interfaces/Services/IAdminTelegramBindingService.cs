using Application.DTOs.AdminTelegramBinding;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IAdminTelegramBindingService
{
    Task<Result<PageResult<GetAdminTelegramBindingDto>>> GetAllAsync(GetAdminTelegramBindingFilterDto filter);
    Task<Result<GetAdminTelegramBindingDto>> GetByIdAsync(Guid id);
    Task<Result<InitiateLinkResponseDto>> InitiateLinkAsync(InitiateLinkDto dto);
    /// <summary>callerId — кто подтверждает: по нему ограничено число неверных кодов.</summary>
    Task<Result<GetAdminTelegramBindingDto>> ConfirmLinkAsync(ConfirmLinkDto dto, string? callerId = null);
    Task<Result<bool>> UnlinkAsync(Guid userId);
}
