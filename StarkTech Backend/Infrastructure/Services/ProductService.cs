using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.Product;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Common;
using Domain.Entities;
using Infrastructure.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class ProductService : IProductService
{
    private readonly IProductRepository _productRepository;
    private readonly IFileService _fileService;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ProductService> _logger;

    private const string ProductsCacheVersionKey = "Products:version";
    private const string ProductImageFolder = "products";

    public ProductService(
        IProductRepository productRepository,
        IFileService fileService,
        IDistributedCache cache,
        ILogger<ProductService> logger)
    {
        _productRepository = productRepository;
        _fileService = fileService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetProductDto>>> GetAllAsync(GetProductFilterDto filter)
    {
        var version = await GetProductsCacheVersionAsync();

        var json = JsonSerializer.Serialize(filter);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var key = $"Products:t:v{version}:{hash}"; // «t» — в ответе есть скидки за количество

        var cached = await _cache.GetAsync<PageResult<GetProductDto>>(key);
        if (cached != null)
        {
            _logger.LogInformation("Cache HIT for key: {Key}", key);
            return Result<PageResult<GetProductDto>>.Ok(cached);
        }

        _logger.LogInformation("Cache MISS for key: {Key}", key);

        var products = await _productRepository.GetAllAsync(filter);

        var items = products.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetProductDto>(
            items,
            products.TotalCount,
            products.Page,
            products.PageSize);

        await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

        return Result<PageResult<GetProductDto>>.Ok(pageResult);
    }

    public async Task<Result<GetProductDto>> GetByIdAsync(Guid id)
    {
        var key = ProductKey(id);

        var cached = await _cache.GetAsync<GetProductDto>(key);
        if (cached != null)
            return Result<GetProductDto>.Ok(cached);

        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return Result<GetProductDto>.Fail("Product not found", ErrorType.NotFound);

        var dto = ToDto(product);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetProductDto>.Ok(dto);
    }

    public async Task<Result<CreateProductResponseDto>> CreateAsync(CreateProductDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NameEn))
            return Result<CreateProductResponseDto>.Fail("Name is required", ErrorType.Validation);

        var exists = await _productRepository.ExistsByNameAsync(dto.CategoryId, dto.NameEn);
        if (exists)
            return Result<CreateProductResponseDto>.Fail("Product with the same name already exists in this category", ErrorType.Conflict);

        var tiersError = ValidateTiers(dto.QuantityTiers);
        if (tiersError != null)
            return Result<CreateProductResponseDto>.Fail(tiersError, ErrorType.Validation);

        var product = new Product
        {
            CategoryId = dto.CategoryId,
            NameRu = dto.NameRu,
            NameTj = dto.NameTj,
            NameEn = dto.NameEn,
            DescriptionRu = dto.DescriptionRu,
            DescriptionTj = dto.DescriptionTj,
            DescriptionEn = dto.DescriptionEn,
            BasePrice = dto.BasePrice,
            MainImageUrl = dto.MainImageUrl,
            RequiresPhotoUpload = dto.RequiresPhotoUpload,
            QuantityTiersJson = SerializeTiers(dto.QuantityTiers)
        };

        await _productRepository.AddAsync(product);

        await ClearProductsCacheAsync();

        _logger.LogInformation("Product created with ID: {Id}", product.Id);

        return Result<CreateProductResponseDto>.Ok(new CreateProductResponseDto
        {
            Id = product.Id,
            CategoryId = product.CategoryId,
            NameRu = product.NameRu,
            NameTj = product.NameTj,
            NameEn = product.NameEn,
            BasePrice = product.BasePrice,
            QuantityTiers = ToTierDtos(product.QuantityTiersJson)
        });
    }

    public async Task<Result<UpdateProductResponseDto>> UpdateAsync(Guid id, UpdateProductDto dto)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return Result<UpdateProductResponseDto>.Fail("Product not found", ErrorType.NotFound);

        var tiersError = ValidateTiers(dto.QuantityTiers);
        if (tiersError != null)
            return Result<UpdateProductResponseDto>.Fail(tiersError, ErrorType.Validation);

        product.CategoryId = dto.CategoryId;
        product.NameRu = dto.NameRu;
        product.NameTj = dto.NameTj;
        product.NameEn = dto.NameEn;
        product.DescriptionRu = dto.DescriptionRu;
        product.DescriptionTj = dto.DescriptionTj;
        product.DescriptionEn = dto.DescriptionEn;
        product.BasePrice = dto.BasePrice;
        product.IsActive = dto.IsActive;
        product.MainImageUrl = dto.MainImageUrl;
        product.RequiresPhotoUpload = dto.RequiresPhotoUpload;
        // null — форма не прислала ступени (старый клиент): оставляем как было.
        if (dto.QuantityTiers != null)
            product.QuantityTiersJson = SerializeTiers(dto.QuantityTiers);

        var success = await _productRepository.UpdateAsync(product);
        if (!success)
            return Result<UpdateProductResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        await _cache.RemoveAsync(ProductKey(id));
        await ClearProductsCacheAsync();

        return Result<UpdateProductResponseDto>.Ok(new UpdateProductResponseDto
        {
            Id = product.Id,
            CategoryId = product.CategoryId,
            NameRu = product.NameRu,
            NameTj = product.NameTj,
            NameEn = product.NameEn,
            BasePrice = product.BasePrice,
            IsActive = product.IsActive,
            QuantityTiers = ToTierDtos(product.QuantityTiersJson)
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return Result<bool>.Fail("Product not found", ErrorType.NotFound);

        // Мягкое удаление: запись и фото остаются, чтобы товар можно было восстановить,
        // а старые заказы продолжали показывать позиции.
        product.IsDeleted = true;
        product.DeletedAt = DateTime.UtcNow;
        await _productRepository.UpdateAsync(product);

        await _cache.RemoveAsync(ProductKey(id));
        await ClearProductsCacheAsync();

        _logger.LogInformation("Product {Id} moved to trash", id);

        return Result<bool>.Ok(true);
    }

    public async Task<Result<GetProductDto>> RestoreAsync(Guid id)
    {
        var product = await _productRepository.GetDeletedByIdAsync(id);
        if (product == null)
            return Result<GetProductDto>.Fail("Deleted product not found", ErrorType.NotFound);

        // Пока товар лежал в корзине, его название могли занять.
        if (await _productRepository.ExistsByNameAsync(product.CategoryId, product.NameEn))
            return Result<GetProductDto>.Fail(
                "В этой категории уже есть товар с таким названием. Переименуйте его и восстановите снова.",
                ErrorType.Conflict);

        product.IsDeleted = false;
        product.DeletedAt = null;
        await _productRepository.UpdateAsync(product);

        await ClearProductsCacheAsync();

        _logger.LogInformation("Product {Id} restored from trash", id);

        return Result<GetProductDto>.Ok(ToDto(product));
    }

    public async Task<Result<GetProductDto>> UploadImageAsync(Guid id, IFormFile file)
    {
        var fileError = _fileService.ValidateImage(file);
        if (fileError != null)
            return Result<GetProductDto>.Fail(fileError, ErrorType.Validation);

        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return Result<GetProductDto>.Fail("Product not found", ErrorType.NotFound);

        var url = await _fileService.UploadAsync(file, ProductImageFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<GetProductDto>.Fail("File upload failed", ErrorType.Unknown);

        var previousUrl = product.MainImageUrl;

        product.MainImageUrl = url;
        await _productRepository.UpdateAsync(product);

        if (!string.IsNullOrWhiteSpace(previousUrl))
            await _fileService.DeleteAsync(previousUrl);

        await _cache.RemoveAsync(ProductKey(id));
        await ClearProductsCacheAsync();

        _logger.LogInformation("Image uploaded for product {Id}", id);

        return Result<GetProductDto>.Ok(ToDto(product));
    }

    public async Task<Result<GetProductDto>> DeleteImageAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return Result<GetProductDto>.Fail("Product not found", ErrorType.NotFound);

        if (string.IsNullOrWhiteSpace(product.MainImageUrl))
            return Result<GetProductDto>.Ok(ToDto(product));

        var previousUrl = product.MainImageUrl;

        product.MainImageUrl = null;
        await _productRepository.UpdateAsync(product);

        await _fileService.DeleteAsync(previousUrl);

        await _cache.RemoveAsync(ProductKey(id));
        await ClearProductsCacheAsync();

        return Result<GetProductDto>.Ok(ToDto(product));
    }

    private static GetProductDto ToDto(Product product) => new()
    {
        Id = product.Id,
        CategoryId = product.CategoryId,
        NameRu = product.NameRu,
        NameTj = product.NameTj,
        NameEn = product.NameEn,
        DescriptionRu = product.DescriptionRu,
        DescriptionTj = product.DescriptionTj,
        DescriptionEn = product.DescriptionEn,
        BasePrice = product.BasePrice,
        IsActive = product.IsActive,
        MainImageUrl = product.MainImageUrl,
        RequiresPhotoUpload = product.RequiresPhotoUpload,
        DeletedAt = product.DeletedAt,
        QuantityTiers = ToTierDtos(product.QuantityTiersJson)
    };

    // «t» в ключе — в карточке есть скидки за количество (старые записи кэша без них не читаем).
    private static string ProductKey(Guid id) => $"Product:t:{id}";

    private const int MaxQuantityTiers = 6;

    private static List<QuantityTierDto> ToTierDtos(string? json)
        => QuantityTiers.Parse(json)
            .Select(t => new QuantityTierDto { MinQuantity = t.MinQuantity, DiscountPercent = t.DiscountPercent })
            .ToList();

    private static string? SerializeTiers(List<QuantityTierDto>? tiers)
        => QuantityTiers.Serialize(tiers?.Select(t => new QuantityTier(t.MinQuantity, t.DiscountPercent)));

    // Ступени: от 2 штук, скидка строго между 0 и 100 %, без повторов количества, не больше 6,
    // и чем больше штук — тем больше скидка (иначе покупателю выгоднее взять меньше).
    private static string? ValidateTiers(List<QuantityTierDto>? tiers)
    {
        if (tiers == null || tiers.Count == 0)
            return null;

        if (tiers.Count > MaxQuantityTiers)
            return $"Скидок за количество — не больше {MaxQuantityTiers}";

        foreach (var t in tiers)
        {
            if (t.MinQuantity < 2)
                return "Скидка за количество действует от 2 штук";
            if (t.DiscountPercent <= 0 || t.DiscountPercent >= 100)
                return "Процент скидки за количество — больше 0 и меньше 100";
        }

        if (tiers.Select(t => t.MinQuantity).Distinct().Count() != tiers.Count)
            return "Количество в скидках не должно повторяться";

        var ordered = tiers.OrderBy(t => t.MinQuantity).ToList();
        for (var i = 1; i < ordered.Count; i++)
        {
            if (ordered[i].DiscountPercent <= ordered[i - 1].DiscountPercent)
                return $"Скидка должна расти с количеством: от {ordered[i].MinQuantity} шт. она должна быть больше, чем от {ordered[i - 1].MinQuantity} шт.";
        }

        return null;
    }

    private async Task<int> GetProductsCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(ProductsCacheVersionKey);
        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearProductsCacheAsync()
    {
        var nextVersion = await GetProductsCacheVersionAsync() + 1;
        await _cache.SetStringAsync(ProductsCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation("Products cache version incremented to {Version}", nextVersion);
    }
}
