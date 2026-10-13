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

    public async Task<Result<GetOrderItemPhotoDto>> UploadAsync(Guid orderItemId, IFormFile file, int copies, Guid? restrictToUserId)
    {
        var orderItem = await _orderItemRepository.GetByIdAsync(orderItemId);
        if (!IsAccessible(orderItem, restrictToUserId))
            return Result<GetOrderItemPhotoDto>.Fail("Order item not found", ErrorType.NotFound);

        if (!orderItem!.ProductVariant.Product.RequiresPhotoUpload)
            return Result<GetOrderItemPhotoDto>.Fail("This product does not require a photo upload", ErrorType.Validation);

        if (!EditableStatuses.Contains(orderItem.Order.Status))
            return Result<GetOrderItemPhotoDto>.Fail(NotEditableMessage, ErrorType.Validation);

        // Копий по всем фото не больше, чем штук в позиции (удалённые не считаются)
        var copiesError = await ValidateCopiesAsync(orderItem, copies, excludePhotoId: null);
        if (copiesError != null)
            return Result<GetOrderItemPhotoDto>.Fail(copiesError, ErrorType.Validation);

        var fileError = _fileService.ValidateImage(file);
        if (fileError != null)
            return Result<GetOrderItemPhotoDto>.Fail(fileError, ErrorType.Validation);

        var url = await _fileService.UploadAsync(file, PhotoFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<GetOrderItemPhotoDto>.Fail("Не удалось сохранить файл", ErrorType.Unknown);

        var photo = new OrderItemPhoto
        {
            OrderItemId = orderItemId,
            OriginalPhotoUrl = url,
            Copies = copies
        };

        try
        {
            await _photoRepository.AddAsync(photo);
        }
        catch (Exception ex)
        {
            // Запись в БД не удалась — удаляем только что сохранённый файл, чтобы не оставлять сирот
            _logger.LogError(ex, "Failed to save photo for order item {OrderItemId}", orderItemId);
            await _fileService.DeleteAsync(url);
            return Result<GetOrderItemPhotoDto>.Fail("Не удалось сохранить фото", ErrorType.Unknown);
        }

        var byClient = restrictToUserId.HasValue;
        var who = byClient ? "Клиент" : "Сотрудник";
        await _activity.LogAsync(orderItem.OrderId, $"{who} добавил фото к «{orderItem.ProductVariant.Product.NameRu}»", byClient);

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
            return Result<GetOrderItemPhotoDto>.Fail("Не удалось сохранить файл", ErrorType.Unknown);

        var previousPreviewUrl = photo.EditedPreviewUrl;

        photo.EditedPreviewUrl = url;
        try
        {
            await _photoRepository.UpdateAsync(photo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save edited preview for photo {PhotoId}", photoId);
            await _fileService.DeleteAsync(url);
            return Result<GetOrderItemPhotoDto>.Fail("Не удалось сохранить фото", ErrorType.Unknown);
        }

        // Старое превью удаляем только после успешной записи в БД

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

    public async Task<Result<GetOrderItemPhotoDto>> UpdateCopiesAsync(Guid photoId, UpdateCopiesDto dto, Guid? restrictToUserId)
    {
        var (photo, error, errorType) = await GetEditablePhotoAsync(photoId, restrictToUserId);
        if (photo == null)
            return Result<GetOrderItemPhotoDto>.Fail(error!, errorType);

        var orderItem = await _orderItemRepository.GetByIdAsync(photo.OrderItemId);
        if (orderItem == null)
            return Result<GetOrderItemPhotoDto>.Fail("Photo not found", ErrorType.NotFound);

        if (photo.Copies == dto.Copies)
            return Result<GetOrderItemPhotoDto>.Ok(ToDto(photo));

        // Само фото в сумму не входит — считаем остальные фото позиции плюс новое значение
        var copiesError = await ValidateCopiesAsync(orderItem, dto.Copies, excludePhotoId: photo.Id);
        if (copiesError != null)
            return Result<GetOrderItemPhotoDto>.Fail(copiesError, ErrorType.Validation);

        var oldCopies = photo.Copies;
        photo.Copies = dto.Copies;
        await _photoRepository.UpdateAsync(photo);

        var byClient = restrictToUserId.HasValue;
        var who = byClient ? "Клиент" : "Сотрудник";
        await _activity.LogAsync(orderItem.OrderId,
            $"{who} изменил количество стикеров с фото у «{orderItem.ProductVariant.Product.NameRu}»: {oldCopies} → {dto.Copies}",
            byClient);

        return Result<GetOrderItemPhotoDto>.Ok(ToDto(photo));
    }

    // null — копий можно столько; иначе текст ошибки. Учитываются только неудалённые фото позиции.
    private async Task<string?> ValidateCopiesAsync(OrderItem orderItem, int copies, Guid? excludePhotoId)
    {
        if (copies < 1)
            return "Количество копий должно быть не меньше 1";

        var photos = await _photoRepository.GetByOrderItemIdAsync(orderItem.Id);
        var used = photos.Where(p => p.Id != excludePhotoId).Sum(p => p.Copies);
        if (used + copies > orderItem.Quantity)
            return $"Копий больше, чем штук в позиции — осталось {Math.Max(0, orderItem.Quantity - used)}";

        return null;
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

        // Мягкое удаление: файлы фото НЕ удаляем — сотрудник может восстановить фото.
        // Файлы удаляются только при физическом удалении записи.
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
        Copies = photo.Copies,
        IsDeleted = photo.IsDeleted,
        CreatedAt = photo.CreatedAt
    };
}
