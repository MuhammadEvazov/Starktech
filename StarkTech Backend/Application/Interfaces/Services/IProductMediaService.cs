using Application.DTOs.ProductMedia;
using Application.Results;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IProductMediaService
{
    /// <summary>Вся галерея товара: общая и всех вариантов, по порядку.</summary>
    Task<Result<List<ProductMediaDto>>> GetByProductAsync(Guid productId);
    Task<Result<ProductMediaDto>> UploadAsync(Guid productId, Guid? variantId, IFormFile file);
    Task<Result<List<ProductMediaDto>>> ReorderAsync(Guid productId, List<Guid> ids);
    Task<Result<bool>> DeleteAsync(Guid mediaId);
    /// <summary>Удаляет файлы галереи варианта с диска (записи удалит каскад).</summary>
    Task DeleteVariantFilesAsync(Guid variantId);
}
