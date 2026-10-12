using Application.DTOs.PortfolioItem;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class PortfolioItemService : IPortfolioItemService
{
    private readonly IPortfolioItemRepository _portfolioItemRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IFileService _fileService;
    private readonly ILogger<PortfolioItemService> _logger;

    private const string PortfolioImageFolder = "portfolio";

    public PortfolioItemService(
        IPortfolioItemRepository portfolioItemRepository,
        ICategoryRepository categoryRepository,
        IFileService fileService,
        ILogger<PortfolioItemService> logger)
    {
        _portfolioItemRepository = portfolioItemRepository;
        _categoryRepository = categoryRepository;
        _fileService = fileService;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetPortfolioItemDto>>> GetAllAsync(GetPortfolioItemFilterDto filter)
    {
        var items = await _portfolioItemRepository.GetAllAsync(filter);

        var dtos = items.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetPortfolioItemDto>(
            dtos,
            items.TotalCount,
            items.Page,
            items.PageSize);

        return Result<PageResult<GetPortfolioItemDto>>.Ok(pageResult);
    }

    public async Task<Result<GetPortfolioItemDto>> GetByIdAsync(Guid id)
    {
        var item = await _portfolioItemRepository.GetByIdAsync(id);
        if (item == null)
            return Result<GetPortfolioItemDto>.Fail("Portfolio item not found", ErrorType.NotFound);

        return Result<GetPortfolioItemDto>.Ok(ToDto(item));
    }

    public async Task<Result<CreatePortfolioItemResponseDto>> CreateAsync(CreatePortfolioItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ImageUrl))
            return Result<CreatePortfolioItemResponseDto>.Fail("Image URL is required", ErrorType.Validation);

        if (dto.CategoryId.HasValue && await _categoryRepository.GetByIdAsync(dto.CategoryId.Value) == null)
            return Result<CreatePortfolioItemResponseDto>.Fail("Category not found", ErrorType.NotFound);

        var item = new PortfolioItem
        {
            ImageUrl = dto.ImageUrl,
            CategoryId = dto.CategoryId,
            DescriptionRu = dto.DescriptionRu,
            DescriptionTj = dto.DescriptionTj,
            DescriptionEn = dto.DescriptionEn,
            SortOrder = dto.SortOrder
        };

        await _portfolioItemRepository.AddAsync(item);

        _logger.LogInformation("Portfolio item created with ID: {Id}", item.Id);

        return Result<CreatePortfolioItemResponseDto>.Ok(new CreatePortfolioItemResponseDto
        {
            Id = item.Id,
            ImageUrl = item.ImageUrl,
            CategoryId = item.CategoryId
        });
    }

    public async Task<Result<UpdatePortfolioItemResponseDto>> UpdateAsync(Guid id, UpdatePortfolioItemDto dto)
    {
        var item = await _portfolioItemRepository.GetByIdAsync(id);
        if (item == null)
            return Result<UpdatePortfolioItemResponseDto>.Fail("Portfolio item not found", ErrorType.NotFound);

        if (string.IsNullOrWhiteSpace(dto.ImageUrl))
            return Result<UpdatePortfolioItemResponseDto>.Fail("Image URL is required", ErrorType.Validation);

        if (dto.CategoryId.HasValue && await _categoryRepository.GetByIdAsync(dto.CategoryId.Value) == null)
            return Result<UpdatePortfolioItemResponseDto>.Fail("Category not found", ErrorType.NotFound);

        item.ImageUrl = dto.ImageUrl;
        item.CategoryId = dto.CategoryId;
        item.DescriptionRu = dto.DescriptionRu;
        item.DescriptionTj = dto.DescriptionTj;
        item.DescriptionEn = dto.DescriptionEn;
        item.SortOrder = dto.SortOrder;
        item.IsActive = dto.IsActive;

        var success = await _portfolioItemRepository.UpdateAsync(item);
        if (!success)
            return Result<UpdatePortfolioItemResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        return Result<UpdatePortfolioItemResponseDto>.Ok(new UpdatePortfolioItemResponseDto
        {
            Id = item.Id,
            ImageUrl = item.ImageUrl,
            CategoryId = item.CategoryId,
            IsActive = item.IsActive
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var item = await _portfolioItemRepository.GetByIdAsync(id);
        if (item == null)
            return Result<bool>.Fail("Portfolio item not found", ErrorType.NotFound);

        await _portfolioItemRepository.DeleteAsync(item);

        return Result<bool>.Ok(true);
    }

    public async Task<Result<CreatePortfolioItemResponseDto>> CreateWithImageAsync(CreatePortfolioItemWithImageDto dto)
    {
        var fileError = _fileService.ValidateImage(dto.File);
        if (fileError != null)
            return Result<CreatePortfolioItemResponseDto>.Fail(fileError, ErrorType.Validation);

        if (dto.CategoryId.HasValue && await _categoryRepository.GetByIdAsync(dto.CategoryId.Value) == null)
            return Result<CreatePortfolioItemResponseDto>.Fail("Category not found", ErrorType.NotFound);

        var url = await _fileService.UploadAsync(dto.File, PortfolioImageFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<CreatePortfolioItemResponseDto>.Fail("File upload failed", ErrorType.Unknown);

        var item = new PortfolioItem
        {
            ImageUrl = url,
            CategoryId = dto.CategoryId,
            DescriptionRu = dto.DescriptionRu,
            DescriptionTj = dto.DescriptionTj,
            DescriptionEn = dto.DescriptionEn,
            SortOrder = dto.SortOrder
        };

        await _portfolioItemRepository.AddAsync(item);

        _logger.LogInformation("Portfolio item created with uploaded image, ID: {Id}", item.Id);

        return Result<CreatePortfolioItemResponseDto>.Ok(new CreatePortfolioItemResponseDto
        {
            Id = item.Id,
            ImageUrl = item.ImageUrl,
            CategoryId = item.CategoryId
        });
    }

    public async Task<Result<GetPortfolioItemDto>> UploadImageAsync(Guid id, IFormFile file)
    {
        var fileError = _fileService.ValidateImage(file);
        if (fileError != null)
            return Result<GetPortfolioItemDto>.Fail(fileError, ErrorType.Validation);

        var item = await _portfolioItemRepository.GetByIdAsync(id);
        if (item == null)
            return Result<GetPortfolioItemDto>.Fail("Portfolio item not found", ErrorType.NotFound);

        var url = await _fileService.UploadAsync(file, PortfolioImageFolder);
        if (string.IsNullOrWhiteSpace(url))
            return Result<GetPortfolioItemDto>.Fail("File upload failed", ErrorType.Unknown);

        var previousUrl = item.ImageUrl;

        item.ImageUrl = url;
        await _portfolioItemRepository.UpdateAsync(item);

        if (!string.IsNullOrWhiteSpace(previousUrl))
            await _fileService.DeleteAsync(previousUrl);

        _logger.LogInformation("Image replaced for portfolio item {Id}", id);

        return Result<GetPortfolioItemDto>.Ok(ToDto(item));
    }

    private static GetPortfolioItemDto ToDto(PortfolioItem item) => new()
    {
        Id = item.Id,
        ImageUrl = item.ImageUrl,
        CategoryId = item.CategoryId,
        CategoryNameEn = item.Category?.NameEn,
        DescriptionRu = item.DescriptionRu,
        DescriptionTj = item.DescriptionTj,
        DescriptionEn = item.DescriptionEn,
        SortOrder = item.SortOrder,
        IsActive = item.IsActive
    };
}
