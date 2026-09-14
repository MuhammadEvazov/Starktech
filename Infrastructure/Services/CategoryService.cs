using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.Category;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class CategoryService : ICategoryService
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly IFileService _fileService;
    private readonly IDistributedCache _cache;
    private readonly ILogger<CategoryService> _logger;

    private const string CategoriesCacheVersionKey = "Categories:version";
    private const string CategoryImageFolder = "categories";

    public CategoryService(
        ICategoryRepository categoryRepository,
        IFileService fileService,
        IDistributedCache cache,
        ILogger<CategoryService> logger)
    {
        _categoryRepository = categoryRepository;
        _fileService = fileService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetCategoryDto>>> GetAllAsync(GetCategoryFilterDto filter)
    {
        var version = await GetCategoriesCacheVersionAsync();

        var json = JsonSerializer.Serialize(filter);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var key = $"Categories:v{version}:{hash}";

        var cached = await _cache.GetAsync<PageResult<GetCategoryDto>>(key);
        if (cached != null)
        {
            _logger.LogInformation("Cache HIT for key: {Key}", key);
            return Result<PageResult<GetCategoryDto>>.Ok(cached);
        }

        _logger.LogInformation("Cache MISS for key: {Key}", key);

        var categories = await _categoryRepository.GetAllAsync(filter);

        var items = categories.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetCategoryDto>(
            items,
            categories.TotalCount,
            categories.Page,
            categories.PageSize);

        await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

        return Result<PageResult<GetCategoryDto>>.Ok(pageResult);
    }

    public async Task<Result<GetCategoryDto>> GetByIdAsync(Guid id)
    {
        var key = $"Category:{id}";

        var cached = await _cache.GetAsync<GetCategoryDto>(key);
        if (cached != null)
            return Result<GetCategoryDto>.Ok(cached);

        var category = await _categoryRepository.GetByIdAsync(id);
        if (category == null)
            return Result<GetCategoryDto>.Fail("Category not found", ErrorType.NotFound);

        var dto = ToDto(category);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetCategoryDto>.Ok(dto);
    }

    public async Task<Result<CreateCategoryResponseDto>> CreateAsync(CreateCategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Slug))
            return Result<CreateCategoryResponseDto>.Fail("Slug is required", ErrorType.Validation);

        var exists = await _categoryRepository.ExistsBySlugAsync(dto.Slug);
        if (exists)
            return Result<CreateCategoryResponseDto>.Fail("Category with the same slug already exists", ErrorType.Conflict);

        var category = new Category
        {
            NameRu = dto.NameRu,
            NameTj = dto.NameTj,
            NameEn = dto.NameEn,
            Slug = dto.Slug,
            DescriptionRu = dto.DescriptionRu,
            DescriptionTj = dto.DescriptionTj,
            DescriptionEn = dto.DescriptionEn,
            ImageUrl = dto.ImageUrl,
            SortOrder = dto.SortOrder
        };

        await _categoryRepository.AddAsync(category);

        await ClearCategoriesCacheAsync();

        _logger.LogInformation("Category created with ID: {Id}", category.Id);

        return Result<CreateCategoryResponseDto>.Ok(new CreateCategoryResponseDto
        {
            Id = category.Id,
            NameRu = category.NameRu,
            NameTj = category.NameTj,
            NameEn = category.NameEn,
            Slug = category.Slug
        });
    }

    public async Task<Result<UpdateCategoryResponseDto>> UpdateAsync(Guid id, UpdateCategoryDto dto)
    {
        var category = await _categoryRepository.GetByIdAsync(id);
        if (category == null)
            return Result<UpdateCategoryResponseDto>.Fail("Category not found", ErrorType.NotFound);

        if (!string.Equals(category.Slug, dto.Slug, StringComparison.OrdinalIgnoreCase))
        {
            var slugTaken = await _categoryRepository.ExistsBySlugAsync(dto.Slug);
            if (slugTaken)
                return Result<UpdateCategoryResponseDto>.Fail("Category with the same slug already exists", ErrorType.Conflict);
        }

        category.NameRu = dto.NameRu;
        category.NameTj = dto.NameTj;
        category.NameEn = dto.NameEn;
        category.Slug = dto.Slug;
        category.DescriptionRu = dto.DescriptionRu;
        category.DescriptionTj = dto.DescriptionTj;
        category.DescriptionEn = dto.DescriptionEn;
        category.ImageUrl = dto.ImageUrl;
        category.IsActive = dto.IsActive;
        category.SortOrder = dto.SortOrder;

        var success = await _categoryRepository.UpdateAsync(category);
        if (!success)
            return Result<UpdateCategoryResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        await _cache.RemoveAsync($"Category:{id}");
        await ClearCategoriesCacheAsync();

        return Result<UpdateCategoryResponseDto>.Ok(new UpdateCategoryResponseDto
        {
            Id = category.Id,
            NameRu = category.NameRu,
            NameTj = category.NameTj,
            NameEn = category.NameEn,
            Slug = category.Slug,
            IsActive = category.IsActive
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var category = await _categoryRepository.GetByIdAsync(id);
        if (category == null)
            return Result<bool>.Fail("Category not found", ErrorType.NotFound);

        var hasProducts = await _categoryRepository.HasProductsAsync(id);
        if (hasProducts)
            return Result<bool>.Fail("Category cannot be deleted because it has products", ErrorType.Conflict);

        await _categoryRepository.DeleteAsync(category);

        await _cache.RemoveAsync($"Category:{id}");
        await ClearCategoriesCacheAsync();

        return Result<bool>.Ok(true);
    }

    public async Task<Result<GetCategoryDto>> UploadImageAsync(Guid id, IFormFile file)
    {
        var fileError = _fileService.ValidateImage(file);
        if (fileError != null)
            return Result<GetCategoryDto>.Fail(fileError, ErrorType.Validation);

        var category = await _categoryRepository.GetByIdAsync(id);
        if (category == null)
            return Result<GetCategoryDto>.Fail("Category not found", ErrorType.NotFound);

        var url = await _fileService.UploadAsync(file, CategoryImageFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<GetCategoryDto>.Fail("File upload failed", ErrorType.Unknown);

        var previousUrl = category.ImageUrl;

        category.ImageUrl = url;
        await _categoryRepository.UpdateAsync(category);

        if (!string.IsNullOrWhiteSpace(previousUrl))
            await _fileService.DeleteAsync(previousUrl);

        await _cache.RemoveAsync($"Category:{id}");
        await ClearCategoriesCacheAsync();

        _logger.LogInformation("Image uploaded for category {Id}", id);

        return Result<GetCategoryDto>.Ok(ToDto(category));
    }

    public async Task<Result<GetCategoryDto>> DeleteImageAsync(Guid id)
    {
        var category = await _categoryRepository.GetByIdAsync(id);
        if (category == null)
            return Result<GetCategoryDto>.Fail("Category not found", ErrorType.NotFound);

        if (string.IsNullOrWhiteSpace(category.ImageUrl))
            return Result<GetCategoryDto>.Ok(ToDto(category));

        var previousUrl = category.ImageUrl;

        category.ImageUrl = null;
        await _categoryRepository.UpdateAsync(category);

        await _fileService.DeleteAsync(previousUrl);

        await _cache.RemoveAsync($"Category:{id}");
        await ClearCategoriesCacheAsync();

        return Result<GetCategoryDto>.Ok(ToDto(category));
    }

    private static GetCategoryDto ToDto(Category category) => new()
    {
        Id = category.Id,
        NameRu = category.NameRu,
        NameTj = category.NameTj,
        NameEn = category.NameEn,
        Slug = category.Slug,
        DescriptionRu = category.DescriptionRu,
        DescriptionTj = category.DescriptionTj,
        DescriptionEn = category.DescriptionEn,
        ImageUrl = category.ImageUrl,
        IsActive = category.IsActive,
        SortOrder = category.SortOrder
    };

    private async Task<int> GetCategoriesCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(CategoriesCacheVersionKey);
        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearCategoriesCacheAsync()
    {
        var nextVersion = await GetCategoriesCacheVersionAsync() + 1;
        await _cache.SetStringAsync(CategoriesCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation("Categories cache version incremented to {Version}", nextVersion);
    }
}
