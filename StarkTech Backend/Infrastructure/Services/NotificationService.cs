using Application.DTOs.Notification;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IEmailService _emailService;
    private readonly ILogger<NotificationService> _logger;
    private readonly AppDbContext _context;

    public NotificationService(
        INotificationRepository notificationRepository,
        IEmailService emailService,
        ILogger<NotificationService> logger,
        AppDbContext context)
    {
        _context = context;
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
        {
            _logger.LogInformation("Order {OrderId} status notification skipped: no contact email", orderId);
            return;
        }

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

        // Уведомление — побочное действие: сбой записи журнала не должен ломать смену статуса заказа
        try
        {
            await _notificationRepository.AddAsync(notification);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save notification record for order {OrderId}", orderId);
            // Не оставляем несохранённую запись в общем контексте — иначе она сломает следующий SaveChanges вызывающего кода
            var entry = _context.ChangeTracker.Entries<Notification>().FirstOrDefault(e => ReferenceEquals(e.Entity, notification));
            if (entry != null)
                entry.State = EntityState.Detached;
        }
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
