using Application.DTOs.OrderItemPhoto;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class OrderItemPhotoService : IOrderItemPhotoService
{
    private readonly IOrderItemPhotoRepository _photoRepository;
    private readonly IOrderItemRepository _orderItemRepository;
    private readonly IFileService _fileService;
    private readonly IOrderActivityService _activity;
    private readonly ILogger<OrderItemPhotoService> _logger;

    private const string PhotoFolder = "order-photos";
    private const string NotEditableMessage = "Photos can only be changed before the order enters production";

    private static readonly OrderStatus[] EditableStatuses = { OrderStatus.New, OrderStatus.Confirmed };

    public OrderItemPhotoService(
        IOrderItemPhotoRepository photoRepository,
        IOrderItemRepository orderItemRepository,
        IFileService fileService,
        IOrderActivityService activity,
        ILogger<OrderItemPhotoService> logger)
    {
        _photoRepository = photoRepository;
        _orderItemRepository = orderItemRepository;
        _fileService = fileService;
        _activity = activity;
        _logger = logger;
    }

    public async Task<Result<List<GetOrderItemPhotoDto>>> GetByOrderItemIdAsync(Guid orderItemId, Guid? restrictToUserId)
    {
        var orderItem = await _orderItemRepository.GetByIdAsync(orderItemId);
        if (!IsAccessible(orderItem, restrictToUserId))
            return Result<List<GetOrderItemPhotoDto>>.Fail("Order item not found", ErrorType.NotFound);

        var photos = await _photoRepository.GetByOrderItemIdAsync(orderItemId);

        return Result<List<GetOrderItemPhotoDto>>.Ok(photos.Select(ToDto).ToList());
    }

    public async Task<Result<GetOrderItemPhotoDto>> UploadAsync(Guid orderItemId, IFormFile file, Guid? restrictToUserId)
    {
        var orderItem = await _orderItemRepository.GetByIdAsync(orderItemId);
        if (!IsAccessible(orderItem, restrictToUserId))
            return Result<GetOrderItemPhotoDto>.Fail("Order item not found", ErrorType.NotFound);

        if (!orderItem!.ProductVariant.Product.RequiresPhotoUpload)
            return Result<GetOrderItemPhotoDto>.Fail("This product does not require a photo upload", ErrorType.Validation);

        if (!EditableStatuses.Contains(orderItem.Order.Status))
            return Result<GetOrderItemPhotoDto>.Fail(NotEditableMessage, ErrorType.Validation);

        var fileError = _fileService.ValidateImage(file);
        if (fileError != null)
            return Result<GetOrderItemPhotoDto>.Fail(fileError, ErrorType.Validation);

        var url = await _fileService.UploadAsync(file, PhotoFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<GetOrderItemPhotoDto>.Fail("File upload failed", ErrorType.Unknown);

        var photo = new OrderItemPhoto
        {
            OrderItemId = orderItemId,
            OriginalPhotoUrl = url
        };

        await _photoRepository.AddAsync(photo);
        await _activity.LogAsync(orderItem.OrderId, $"Клиент добавил фото к «{orderItem.ProductVariant.Product.NameRu}»", byClient: true);

        _logger.LogInformation("Photo uploaded for order item {OrderItemId}", orderItemId);

        return Result<GetOrderItemPhotoDto>.Ok(ToDto(photo));
    }

    public async Task<Result<GetOrderItemPhotoDto>> UploadEditedPreviewAsync(Guid photoId, IFormFile file, Guid? restrictToUserId)
    {
        var (photo, error, errorType) = await GetEditablePhotoAsync(photoId, restrictToUserId);
        if (photo == null)
            return Result<GetOrderItemPhotoDto>.Fail(error!, errorType);

        var fileError = _fileService.ValidateImage(file);
        if (fileError != null)
            return Result<GetOrderItemPhotoDto>.Fail(fileError, ErrorType.Validation);

        var url = await _fileService.UploadAsync(file, PhotoFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<GetOrderItemPhotoDto>.Fail("File upload failed", ErrorType.Unknown);

        var previousPreviewUrl = photo.EditedPreviewUrl;

        photo.EditedPreviewUrl = url;
        await _photoRepository.UpdateAsync(photo);

        if (!string.IsNullOrWhiteSpace(previousPreviewUrl))
            await _fileService.DeleteAsync(previousPreviewUrl);

        var cropped = await _orderItemRepository.GetByIdAsync(photo.OrderItemId);
        if (cropped != null)
        {
            var who = restrictToUserId.HasValue ? "Клиент" : "Сотрудник";
            await _activity.LogAsync(cropped.OrderId, $"{who} изменил кадр фото у «{cropped.ProductVariant.Product.NameRu}»", restrictToUserId.HasValue);
        }

        return Result<GetOrderItemPhotoDto>.Ok(ToDto(photo));
    }

    public async Task<Result<GetOrderItemPhotoDto>> UpdateCropDataAsync(Guid photoId, UpdateCropDataDto dto, Guid? restrictToUserId)
    {
        var (photo, error, errorType) = await GetEditablePhotoAsync(photoId, restrictToUserId);
        if (photo == null)
            return Result<GetOrderItemPhotoDto>.Fail(error!, errorType);

        photo.CropDataJson = dto.CropDataJson;
        await _photoRepository.UpdateAsync(photo);

        return Result<GetOrderItemPhotoDto>.Ok(ToDto(photo));
    }

    public async Task<Result<bool>> DeleteAsync(Guid photoId, Guid? restrictToUserId)
    {
        var photo = await _photoRepository.GetByIdAsync(photoId);
        if (photo == null)
            return Result<bool>.Fail("Photo not found", ErrorType.NotFound);

        var orderItem = await _orderItemRepository.GetByIdAsync(photo.OrderItemId);
        if (!IsAccessible(orderItem, restrictToUserId))
            return Result<bool>.Fail("Photo not found", ErrorType.NotFound);

        if (photo.IsDeleted)
            return Result<bool>.Ok(true);

        if (!EditableStatuses.Contains(orderItem!.Order.Status))
            return Result<bool>.Fail(NotEditableMessage, ErrorType.Validation);

        photo.IsDeleted = true;
        photo.DeletedAt = DateTime.UtcNow;
        await _photoRepository.UpdateAsync(photo);

        var who = restrictToUserId.HasValue ? "Клиент" : "Сотрудник";
        await _activity.LogAsync(orderItem.Order.Id, $"{who} удалил фото у «{orderItem.ProductVariant.Product.NameRu}»", restrictToUserId.HasValue);

        return Result<bool>.Ok(true);
    }

    private async Task<(OrderItemPhoto? Photo, string? Error, ErrorType ErrorType)> GetEditablePhotoAsync(Guid photoId, Guid? restrictToUserId)
    {
        var photo = await _photoRepository.GetByIdAsync(photoId);
        if (photo == null || photo.IsDeleted)
            return (null, "Photo not found", ErrorType.NotFound);

        var orderItem = await _orderItemRepository.GetByIdAsync(photo.OrderItemId);
        if (!IsAccessible(orderItem, restrictToUserId))
            return (null, "Photo not found", ErrorType.NotFound);

        if (!EditableStatuses.Contains(orderItem!.Order.Status))
            return (null, NotEditableMessage, ErrorType.Validation);

        return (photo, null, ErrorType.None);
    }

    private static bool IsAccessible(OrderItem? orderItem, Guid? restrictToUserId)
        => orderItem != null && (!restrictToUserId.HasValue || orderItem.Order.UserId == restrictToUserId.Value);

    private static GetOrderItemPhotoDto ToDto(OrderItemPhoto photo) => new()
    {
        Id = photo.Id,
        OrderItemId = photo.OrderItemId,
        OriginalPhotoUrl = photo.OriginalPhotoUrl,
        EditedPreviewUrl = photo.EditedPreviewUrl,
        CropDataJson = photo.CropDataJson,
        IsDeleted = photo.IsDeleted,
        CreatedAt = photo.CreatedAt
    };
}
