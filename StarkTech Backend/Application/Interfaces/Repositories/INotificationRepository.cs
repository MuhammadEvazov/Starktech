using Application.DTOs.Notification;
using Application.Result;
using Domain.Entities;

namespace Application.Interfaces.Repositories;

public interface INotificationRepository
{
    Task<PageResult<Notification>> GetAllAsync(GetNotificationFilterDto filter);
    Task<Notification?> GetByIdAsync(Guid id);
    Task<Notification> AddAsync(Notification notification);
}
