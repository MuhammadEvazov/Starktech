using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.ProductVariant;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Extensions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class ProductVariantService : IProductVariantService
{
    private readonly IProductVariantRepository _variantRepository;
    private readonly IProductRepository _productRepository;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ProductVariantService> _logger;

    private const string VariantsCacheVersionKey = "ProductVariants:version";

    public ProductVariantService(
        IProductVariantRepository variantRepository,
        IProductRepository productRepository,
        IDistributedCache cache,
        ILogger<ProductVariantService> logger)
    {
        _variantRepository = variantRepository;
        _productRepository = productRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetProductVariantDto>>> GetAllAsync(GetProductVariantFilterDto filter)
    {
        var version = await GetVariantsCacheVersionAsync();

        var json = JsonSerializer.Serialize(filter);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var key = $"ProductVariants:v{version}:{hash}";

        var cached = await _cache.GetAsync<PageResult<GetProductVariantDto>>(key);
        if (cached != null)
        {
            _logger.LogInformation("Cache HIT for key: {Key}", key);
            return Result<PageResult<GetProductVariantDto>>.Ok(cached);
        }

        _logger.LogInformation("Cache MISS for key: {Key}", key);

        var variants = await _variantRepository.GetAllAsync(filter);

        var items = variants.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetProductVariantDto>(
            items,
            variants.TotalCount,
            variants.Page,
            variants.PageSize);

        await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

        return Result<PageResult<GetProductVariantDto>>.Ok(pageResult);
    }

    public async Task<Result<GetProductVariantDto>> GetByIdAsync(Guid id)
    {
        var key = $"ProductVariant:{id}";

        var cached = await _cache.GetAsync<GetProductVariantDto>(key);
        if (cached != null)
            return Result<GetProductVariantDto>.Ok(cached);

        var variant = await _variantRepository.GetByIdAsync(id);
        if (variant == null)
            return Result<GetProductVariantDto>.Fail("Product variant not found", ErrorType.NotFound);

        var dto = ToDto(variant);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetProductVariantDto>.Ok(dto);
    }

    public async Task<Result<CreateProductVariantResponseDto>> CreateAsync(CreateProductVariantDto dto)
    {
        var product = await _productRepository.GetByIdAsync(dto.ProductId);
        if (product == null)
            return Result<CreateProductVariantResponseDto>.Fail("Product not found", ErrorType.NotFound);

        var variant = new ProductVariant
        {
            ProductId = dto.ProductId,
            AttributesJson = dto.AttributesJson,
            Price = dto.Price,
            StockUnlimited = dto.StockUnlimited,
            SKU = dto.SKU
        };

        await _variantRepository.AddAsync(variant);

        await ClearVariantsCacheAsync();

        _logger.LogInformation("Product variant created with ID: {Id}", variant.Id);

        return Result<CreateProductVariantResponseDto>.Ok(new CreateProductVariantResponseDto
        {
            Id = variant.Id,
            ProductId = variant.ProductId,
            Price = variant.Price,
            SKU = variant.SKU
        });
    }

    public async Task<Result<UpdateProductVariantResponseDto>> UpdateAsync(Guid id, UpdateProductVariantDto dto)
    {
        var variant = await _variantRepository.GetByIdAsync(id);
        if (variant == null)
            return Result<UpdateProductVariantResponseDto>.Fail("Product variant not found", ErrorType.NotFound);

        variant.AttributesJson = dto.AttributesJson;
        variant.Price = dto.Price;
        variant.StockUnlimited = dto.StockUnlimited;
        variant.SKU = dto.SKU;
        variant.IsActive = dto.IsActive;

        var success = await _variantRepository.UpdateAsync(variant);
        if (!success)
            return Result<UpdateProductVariantResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        await _cache.RemoveAsync($"ProductVariant:{id}");
        await ClearVariantsCacheAsync();

        return Result<UpdateProductVariantResponseDto>.Ok(new UpdateProductVariantResponseDto
        {
            Id = variant.Id,
            ProductId = variant.ProductId,
            Price = variant.Price,
            SKU = variant.SKU,
            IsActive = variant.IsActive
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var variant = await _variantRepository.GetByIdAsync(id);
        if (variant == null)
            return Result<bool>.Fail("Product variant not found", ErrorType.NotFound);

        var hasOrderItems = await _variantRepository.HasOrderItemsAsync(id);
        if (hasOrderItems)
            return Result<bool>.Fail("Product variant cannot be deleted because it has orders", ErrorType.Conflict);

        await _variantRepository.DeleteAsync(variant);

        await _cache.RemoveAsync($"ProductVariant:{id}");
        await ClearVariantsCacheAsync();

        return Result<bool>.Ok(true);
    }

    private static GetProductVariantDto ToDto(ProductVariant variant) => new()
    {
        Id = variant.Id,
        ProductId = variant.ProductId,
        AttributesJson = variant.AttributesJson,
        Price = variant.Price,
        StockUnlimited = variant.StockUnlimited,
        SKU = variant.SKU,
        IsActive = variant.IsActive
    };

    private async Task<int> GetVariantsCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(VariantsCacheVersionKey);
        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearVariantsCacheAsync()
    {
        var nextVersion = await GetVariantsCacheVersionAsync() + 1;
        await _cache.SetStringAsync(VariantsCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation("Product variants cache version incremented to {Version}", nextVersion);
    }
}
