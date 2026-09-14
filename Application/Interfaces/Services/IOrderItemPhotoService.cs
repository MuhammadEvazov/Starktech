using Application.DTOs.OrderItemPhoto;
using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IOrderItemPhotoService
{
    Task<Result<List<GetOrderItemPhotoDto>>> GetByOrderItemIdAsync(Guid orderItemId);
    Task<Result<GetOrderItemPhotoDto>> UploadAsync(Guid orderItemId, IFormFile file);
    Task<Result<GetOrderItemPhotoDto>> UploadEditedPreviewAsync(Guid photoId, IFormFile file);
    Task<Result<GetOrderItemPhotoDto>> UpdateCropDataAsync(Guid photoId, UpdateCropDataDto dto);
    Task<Result<bool>> DeleteAsync(Guid photoId);
}
