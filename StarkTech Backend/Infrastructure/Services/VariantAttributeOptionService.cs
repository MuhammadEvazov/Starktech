using Application.DTOs.VariantAttributeOption;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class VariantAttributeOptionService : IVariantAttributeOptionService
{
    private readonly IVariantAttributeOptionRepository _optionRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ILogger<VariantAttributeOptionService> _logger;

    public VariantAttributeOptionService(
        IVariantAttributeOptionRepository optionRepository,
        ICategoryRepository categoryRepository,
        ILogger<VariantAttributeOptionService> logger)
    {
        _optionRepository = optionRepository;
        _categoryRepository = categoryRepository;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetVariantAttributeOptionDto>>> GetAllAsync(GetVariantAttributeOptionFilterDto filter)
    {
        var options = await _optionRepository.GetAllAsync(filter);

        var items = options.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetVariantAttributeOptionDto>(
            items,
            options.TotalCount,
            options.Page,
            options.PageSize);

        return Result<PageResult<GetVariantAttributeOptionDto>>.Ok(pageResult);
    }

    public async Task<Result<GetVariantAttributeOptionDto>> GetByIdAsync(Guid id)
    {
        var option = await _optionRepository.GetByIdAsync(id);
        if (option == null)
            return Result<GetVariantAttributeOptionDto>.Fail("Variant attribute option not found", ErrorType.NotFound);

        return Result<GetVariantAttributeOptionDto>.Ok(ToDto(option));
    }

    public async Task<Result<Dictionary<string, List<GetVariantAttributeOptionDto>>>> GetGroupedByCategoryAsync(Guid categoryId)
    {
        if (await _categoryRepository.GetByIdAsync(categoryId) == null)
            return Result<Dictionary<string, List<GetVariantAttributeOptionDto>>>.Fail("Category not found", ErrorType.NotFound);

        var options = await _optionRepository.GetByCategoryIdAsync(categoryId);

        var grouped = options
            .GroupBy(o => o.AttributeKey)
            .ToDictionary(g => g.Key, g => g.Select(ToDto).ToList());

        return Result<Dictionary<string, List<GetVariantAttributeOptionDto>>>.Ok(grouped);
    }

    public async Task<Result<CreateVariantAttributeOptionResponseDto>> CreateAsync(CreateVariantAttributeOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.AttributeKey) || string.IsNullOrWhiteSpace(dto.AttributeValue))
            return Result<CreateVariantAttributeOptionResponseDto>.Fail("Attribute key and value are required", ErrorType.Validation);

        if (await _categoryRepository.GetByIdAsync(dto.CategoryId) == null)
            return Result<CreateVariantAttributeOptionResponseDto>.Fail("Category not found", ErrorType.NotFound);

        if (await _optionRepository.ExistsAsync(dto.CategoryId, dto.AttributeKey, dto.AttributeValue))
            return Result<CreateVariantAttributeOptionResponseDto>.Fail("This attribute option already exists for the category", ErrorType.Conflict);

        var option = new VariantAttributeOption
        {
            CategoryId = dto.CategoryId,
            AttributeKey = dto.AttributeKey,
            AttributeValue = dto.AttributeValue,
            PriceModifier = dto.PriceModifier,
            SortOrder = dto.SortOrder
        };

        await _optionRepository.AddAsync(option);

        _logger.LogInformation("Variant attribute option created with ID: {Id}", option.Id);

        return Result<CreateVariantAttributeOptionResponseDto>.Ok(new CreateVariantAttributeOptionResponseDto
        {
            Id = option.Id,
            CategoryId = option.CategoryId,
            AttributeKey = option.AttributeKey,
            AttributeValue = option.AttributeValue
        });
    }

    public async Task<Result<UpdateVariantAttributeOptionResponseDto>> UpdateAsync(Guid id, UpdateVariantAttributeOptionDto dto)
    {
        var option = await _optionRepository.GetByIdAsync(id);
        if (option == null)
            return Result<UpdateVariantAttributeOptionResponseDto>.Fail("Variant attribute option not found", ErrorType.NotFound);

        if (string.IsNullOrWhiteSpace(dto.AttributeKey) || string.IsNullOrWhiteSpace(dto.AttributeValue))
            return Result<UpdateVariantAttributeOptionResponseDto>.Fail("Attribute key and value are required", ErrorType.Validation);

        var keyOrValueChanged = option.AttributeKey != dto.AttributeKey || option.AttributeValue != dto.AttributeValue;

        if (keyOrValueChanged && await _optionRepository.ExistsAsync(option.CategoryId, dto.AttributeKey, dto.AttributeValue))
            return Result<UpdateVariantAttributeOptionResponseDto>.Fail("This attribute option already exists for the category", ErrorType.Conflict);

        option.AttributeKey = dto.AttributeKey;
        option.AttributeValue = dto.AttributeValue;
        option.PriceModifier = dto.PriceModifier;
        option.SortOrder = dto.SortOrder;

        var success = await _optionRepository.UpdateAsync(option);
        if (!success)
            return Result<UpdateVariantAttributeOptionResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        return Result<UpdateVariantAttributeOptionResponseDto>.Ok(new UpdateVariantAttributeOptionResponseDto
        {
            Id = option.Id,
            AttributeKey = option.AttributeKey,
            AttributeValue = option.AttributeValue,
            PriceModifier = option.PriceModifier
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var option = await _optionRepository.GetByIdAsync(id);
        if (option == null)
            return Result<bool>.Fail("Variant attribute option not found", ErrorType.NotFound);

        await _optionRepository.DeleteAsync(option);

        return Result<bool>.Ok(true);
    }

    private static GetVariantAttributeOptionDto ToDto(VariantAttributeOption option) => new()
    {
        Id = option.Id,
        CategoryId = option.CategoryId,
        AttributeKey = option.AttributeKey,
        AttributeValue = option.AttributeValue,
        PriceModifier = option.PriceModifier,
        SortOrder = option.SortOrder
    };
}
