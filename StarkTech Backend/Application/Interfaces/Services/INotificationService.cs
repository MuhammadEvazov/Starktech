using Application.DTOs.Notification;
using Application.Result;
using Application.Results;
using Domain.Enums;

namespace Application.Interfaces.Services;

public interface INotificationService
{
    Task<Result<PageResult<GetNotificationDto>>> GetAllAsync(GetNotificationFilterDto filter);
    Task<Result<GetNotificationDto>> GetByIdAsync(Guid id);
    Task<Result<GetNotificationDto>> CreateAsync(CreateNotificationDto dto);
    Task NotifyOrderStatusChangeAsync(Guid orderId, string orderNumber, OrderStatus status, string? contactEmail);
}
