using Application.DTOs.OrderItemPhoto;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IOrderItemPhotoService
{
    Task<Result<List<GetOrderItemPhotoDto>>> GetByOrderItemIdAsync(Guid orderItemId, Guid? restrictToUserId);
    Task<Result<GetOrderItemPhotoDto>> UploadAsync(Guid orderItemId, IFormFile file, int copies, Guid? restrictToUserId);
    Task<Result<GetOrderItemPhotoDto>> UploadEditedPreviewAsync(Guid photoId, IFormFile file, Guid? restrictToUserId);
    Task<Result<GetOrderItemPhotoDto>> UpdateCropDataAsync(Guid photoId, UpdateCropDataDto dto, Guid? restrictToUserId);
    Task<Result<GetOrderItemPhotoDto>> UpdateCopiesAsync(Guid photoId, UpdateCopiesDto dto, Guid? restrictToUserId);
    Task<Result<bool>> DeleteAsync(Guid photoId, Guid? restrictToUserId);
}
