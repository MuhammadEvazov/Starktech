using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.ComboOffer;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Extensions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class ComboOfferService : IComboOfferService
{
    private readonly IComboOfferRepository _comboOfferRepository;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ComboOfferService> _logger;

    private const string ComboOffersCacheVersionKey = "ComboOffers:version";

    public ComboOfferService(
        IComboOfferRepository comboOfferRepository,
        IDistributedCache cache,
        ILogger<ComboOfferService> logger)
    {
        _comboOfferRepository = comboOfferRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetComboOfferDto>>> GetAllAsync(GetComboOfferFilterDto filter)
    {
        var version = await GetComboOffersCacheVersionAsync();

        var json = JsonSerializer.Serialize(filter);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var key = $"ComboOffers:v{version}:{hash}";

        var cached = await _cache.GetAsync<PageResult<GetComboOfferDto>>(key);
        if (cached != null)
        {
            _logger.LogInformation("Cache HIT for key: {Key}", key);
            return Result<PageResult<GetComboOfferDto>>.Ok(cached);
        }

        _logger.LogInformation("Cache MISS for key: {Key}", key);

        var comboOffers = await _comboOfferRepository.GetAllAsync(filter);

        var items = comboOffers.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetComboOfferDto>(
            items,
            comboOffers.TotalCount,
            comboOffers.Page,
            comboOffers.PageSize);

        await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

        return Result<PageResult<GetComboOfferDto>>.Ok(pageResult);
    }

    public async Task<Result<GetComboOfferDto>> GetByIdAsync(Guid id)
    {
        var key = $"ComboOffer:{id}";

        var cached = await _cache.GetAsync<GetComboOfferDto>(key);
        if (cached != null)
            return Result<GetComboOfferDto>.Ok(cached);

        var comboOffer = await _comboOfferRepository.GetByIdAsync(id);
        if (comboOffer == null)
            return Result<GetComboOfferDto>.Fail("Combo offer not found", ErrorType.NotFound);

        var dto = ToDto(comboOffer);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetComboOfferDto>.Ok(dto);
    }

    public async Task<Result<CreateComboOfferResponseDto>> CreateAsync(CreateComboOfferDto dto)
    {
        var comboOffer = new ComboOffer
        {
            NameRu = dto.NameRu,
            NameTj = dto.NameTj,
            NameEn = dto.NameEn,
            DiscountType = dto.DiscountType,
            DiscountValue = dto.DiscountValue,
            ProductIdsJson = dto.ProductIdsJson,
            ValidFrom = dto.ValidFrom,
            ValidTo = dto.ValidTo
        };

        await _comboOfferRepository.AddAsync(comboOffer);

        await ClearComboOffersCacheAsync();

        _logger.LogInformation("Combo offer created with ID: {Id}", comboOffer.Id);

        return Result<CreateComboOfferResponseDto>.Ok(new CreateComboOfferResponseDto
        {
            Id = comboOffer.Id,
            NameRu = comboOffer.NameRu,
            NameTj = comboOffer.NameTj,
            NameEn = comboOffer.NameEn,
            DiscountType = comboOffer.DiscountType,
            DiscountValue = comboOffer.DiscountValue
        });
    }

    public async Task<Result<UpdateComboOfferResponseDto>> UpdateAsync(Guid id, UpdateComboOfferDto dto)
    {
        var comboOffer = await _comboOfferRepository.GetByIdAsync(id);
        if (comboOffer == null)
            return Result<UpdateComboOfferResponseDto>.Fail("Combo offer not found", ErrorType.NotFound);

        comboOffer.NameRu = dto.NameRu;
        comboOffer.NameTj = dto.NameTj;
        comboOffer.NameEn = dto.NameEn;
        comboOffer.DiscountType = dto.DiscountType;
        comboOffer.DiscountValue = dto.DiscountValue;
        comboOffer.ProductIdsJson = dto.ProductIdsJson;
        comboOffer.IsActive = dto.IsActive;
        comboOffer.ValidFrom = dto.ValidFrom;
        comboOffer.ValidTo = dto.ValidTo;

        var success = await _comboOfferRepository.UpdateAsync(comboOffer);
        if (!success)
            return Result<UpdateComboOfferResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        await _cache.RemoveAsync($"ComboOffer:{id}");
        await ClearComboOffersCacheAsync();

        return Result<UpdateComboOfferResponseDto>.Ok(new UpdateComboOfferResponseDto
        {
            Id = comboOffer.Id,
            NameRu = comboOffer.NameRu,
            NameTj = comboOffer.NameTj,
            NameEn = comboOffer.NameEn,
            DiscountType = comboOffer.DiscountType,
            DiscountValue = comboOffer.DiscountValue,
            IsActive = comboOffer.IsActive
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var comboOffer = await _comboOfferRepository.GetByIdAsync(id);
        if (comboOffer == null)
            return Result<bool>.Fail("Combo offer not found", ErrorType.NotFound);

        await _comboOfferRepository.DeleteAsync(comboOffer);

        await _cache.RemoveAsync($"ComboOffer:{id}");
        await ClearComboOffersCacheAsync();

        return Result<bool>.Ok(true);
    }

    private static GetComboOfferDto ToDto(ComboOffer comboOffer) => new()
    {
        Id = comboOffer.Id,
        NameRu = comboOffer.NameRu,
        NameTj = comboOffer.NameTj,
        NameEn = comboOffer.NameEn,
        DiscountType = comboOffer.DiscountType,
        DiscountValue = comboOffer.DiscountValue,
        ProductIdsJson = comboOffer.ProductIdsJson,
        IsActive = comboOffer.IsActive,
        ValidFrom = comboOffer.ValidFrom,
        ValidTo = comboOffer.ValidTo
    };

    private async Task<int> GetComboOffersCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(ComboOffersCacheVersionKey);
        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearComboOffersCacheAsync()
    {
        var nextVersion = await GetComboOffersCacheVersionAsync() + 1;
        await _cache.SetStringAsync(ComboOffersCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation("Combo offers cache version incremented to {Version}", nextVersion);
    }
}
