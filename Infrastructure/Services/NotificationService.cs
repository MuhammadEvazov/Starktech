using Application.DTOs.Notification;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IEmailService _emailService;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        INotificationRepository notificationRepository,
        IEmailService emailService,
        ILogger<NotificationService> logger)
    {
        _notificationRepository = notificationRepository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetNotificationDto>>> GetAllAsync(GetNotificationFilterDto filter)
    {
        var notifications = await _notificationRepository.GetAllAsync(filter);

        var items = notifications.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetNotificationDto>(
            items,
            notifications.TotalCount,
            notifications.Page,
            notifications.PageSize);

        return Result<PageResult<GetNotificationDto>>.Ok(pageResult);
    }

    public async Task<Result<GetNotificationDto>> GetByIdAsync(Guid id)
    {
        var notification = await _notificationRepository.GetByIdAsync(id);
        if (notification == null)
            return Result<GetNotificationDto>.Fail("Notification not found", ErrorType.NotFound);

        return Result<GetNotificationDto>.Ok(ToDto(notification));
    }

    public async Task<Result<GetNotificationDto>> CreateAsync(CreateNotificationDto dto)
    {
        var notification = new Notification
        {
            OrderId = dto.OrderId,
            Channel = dto.Channel,
            Status = dto.Status,
            Payload = dto.Payload
        };

        await _notificationRepository.AddAsync(notification);

        return Result<GetNotificationDto>.Ok(ToDto(notification));
    }

    public async Task NotifyOrderStatusChangeAsync(Guid orderId, string orderNumber, OrderStatus status, string? contactEmail)
    {
        if (string.IsNullOrWhiteSpace(contactEmail))
            return;

        var message = $"Order {orderNumber} status changed to {status}";
        var sent = false;

        try
        {
            sent = await _emailService.SendEmailAsync(contactEmail, $"Order {orderNumber} update", message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send order status email for order {OrderId}", orderId);
        }

        var notification = new Notification
        {
            OrderId = orderId,
            Channel = NotificationChannel.Email,
            Status = sent ? NotificationStatus.Sent : NotificationStatus.Failed,
            Payload = message
        };

        await _notificationRepository.AddAsync(notification);
    }

    private static GetNotificationDto ToDto(Notification notification) => new()
    {
        Id = notification.Id,
        OrderId = notification.OrderId,
        OrderNumber = notification.Order?.OrderNumber,
        Channel = notification.Channel,
        Status = notification.Status,
        Payload = notification.Payload,
        CreatedAt = notification.CreatedAt
    };
}
