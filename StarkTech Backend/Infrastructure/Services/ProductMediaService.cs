using Application.DTOs.ProductMedia;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class ProductMediaService : IProductMediaService
{
    private const string MediaFolder = "product-media";
    private const int MaxItemsPerGallery = 30;

    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<ProductMediaService> _logger;

    public ProductMediaService(AppDbContext context, IFileService fileService, ILogger<ProductMediaService> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    public async Task<Result<List<ProductMediaDto>>> GetByProductAsync(Guid productId)
    {
        if (!await _context.Products.AnyAsync(p => p.Id == productId && !p.IsDeleted))
            return Result<List<ProductMediaDto>>.Fail("Product not found", ErrorType.NotFound);

        var items = await _context.Set<ProductMedia>()
            .AsNoTracking()
            .Where(m => m.ProductId == productId)
            .OrderBy(m => m.SortOrder).ThenBy(m => m.CreatedAt)
            .Select(m => ToDto(m))
            .ToListAsync();

        return Result<List<ProductMediaDto>>.Ok(items);
    }

    public async Task<Result<ProductMediaDto>> UploadAsync(Guid productId, Guid? variantId, IFormFile file)
    {
        var error = _fileService.ValidateMedia(file, out var isVideo);
        if (error != null)
            return Result<ProductMediaDto>.Fail(error, ErrorType.Validation);

        if (!await _context.Products.AnyAsync(p => p.Id == productId && !p.IsDeleted))
            return Result<ProductMediaDto>.Fail("Product not found", ErrorType.NotFound);

        if (variantId.HasValue
            && !await _context.ProductVariants.AnyAsync(v => v.Id == variantId && v.ProductId == productId))
            return Result<ProductMediaDto>.Fail("Product variant not found", ErrorType.NotFound);

        var gallery = _context.Set<ProductMedia>()
            .Where(m => m.ProductId == productId && m.ProductVariantId == variantId);

        var count = await gallery.CountAsync();
        if (count >= MaxItemsPerGallery)
            return Result<ProductMediaDto>.Fail($"В галерее уже {MaxItemsPerGallery} файлов — удалите лишние", ErrorType.Validation);

        var url = await _fileService.UploadMediaAsync(file, MediaFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<ProductMediaDto>.Fail("File upload failed", ErrorType.Unknown);

        var media = new ProductMedia
        {
            ProductId = productId,
            ProductVariantId = variantId,
            Url = url,
            IsVideo = isVideo,
            SortOrder = count == 0 ? 0 : await gallery.MaxAsync(m => m.SortOrder) + 1
        };

        _context.Add(media);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Media {Id} added to product {ProductId} (variant {VariantId})", media.Id, productId, variantId);

        return Result<ProductMediaDto>.Ok(ToDto(media));
    }

    public async Task<Result<List<ProductMediaDto>>> ReorderAsync(Guid productId, List<Guid> ids)
    {
        var items = await _context.Set<ProductMedia>()
            .Where(m => m.ProductId == productId && ids.Contains(m.Id))
            .ToListAsync();

        if (items.Count != ids.Distinct().Count())
            return Result<List<ProductMediaDto>>.Fail("Some media items were not found", ErrorType.NotFound);

        // Порядок меняется только внутри одной галереи (товара или одного варианта).
        if (items.Select(m => m.ProductVariantId).Distinct().Count() > 1)
            return Result<List<ProductMediaDto>>.Fail("Items belong to different galleries", ErrorType.Validation);

        for (var i = 0; i < ids.Count; i++)
            items.First(m => m.Id == ids[i]).SortOrder = i;

        await _context.SaveChangesAsync();

        return Result<List<ProductMediaDto>>.Ok(items.OrderBy(m => m.SortOrder).Select(ToDto).ToList());
    }

    public async Task<Result<bool>> DeleteAsync(Guid mediaId)
    {
        var media = await _context.Set<ProductMedia>().FirstOrDefaultAsync(m => m.Id == mediaId);
        if (media == null)
            return Result<bool>.Fail("Media not found", ErrorType.NotFound);

        _context.Remove(media);
        await _context.SaveChangesAsync();
        await _fileService.DeleteAsync(media.Url);

        return Result<bool>.Ok(true);
    }

    public async Task DeleteVariantFilesAsync(Guid variantId)
    {
        var urls = await _context.Set<ProductMedia>()
            .Where(m => m.ProductVariantId == variantId)
            .Select(m => m.Url)
            .ToListAsync();

        foreach (var url in urls)
            await _fileService.DeleteAsync(url);
    }

    private static ProductMediaDto ToDto(ProductMedia m) => new()
    {
        Id = m.Id,
        ProductId = m.ProductId,
        ProductVariantId = m.ProductVariantId,
        Url = m.Url,
        IsVideo = m.IsVideo,
        SortOrder = m.SortOrder
    };
}
