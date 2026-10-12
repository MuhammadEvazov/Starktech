using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.PromoCode;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Extensions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class PromoCodeService : IPromoCodeService
{
    private readonly IPromoCodeRepository _promoCodeRepository;
    private readonly IDistributedCache _cache;
    private readonly ILogger<PromoCodeService> _logger;

    private const string PromoCodesCacheVersionKey = "PromoCodes:version";

    public PromoCodeService(
        IPromoCodeRepository promoCodeRepository,
        IDistributedCache cache,
        ILogger<PromoCodeService> logger)
    {
        _promoCodeRepository = promoCodeRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetPromoCodeDto>>> GetAllAsync(GetPromoCodeFilterDto filter)
    {
        var version = await GetPromoCodesCacheVersionAsync();

        var json = JsonSerializer.Serialize(filter);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var key = $"PromoCodes:v{version}:{hash}";

        var cached = await _cache.GetAsync<PageResult<GetPromoCodeDto>>(key);
        if (cached != null)
        {
            _logger.LogInformation("Cache HIT for key: {Key}", key);
            return Result<PageResult<GetPromoCodeDto>>.Ok(cached);
        }

        _logger.LogInformation("Cache MISS for key: {Key}", key);

        var promoCodes = await _promoCodeRepository.GetAllAsync(filter);

        var items = promoCodes.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetPromoCodeDto>(
            items,
            promoCodes.TotalCount,
            promoCodes.Page,
            promoCodes.PageSize);

        await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

        return Result<PageResult<GetPromoCodeDto>>.Ok(pageResult);
    }

    public async Task<Result<GetPromoCodeDto>> GetByIdAsync(Guid id)
    {
        var key = $"PromoCode:{id}";

        var cached = await _cache.GetAsync<GetPromoCodeDto>(key);
        if (cached != null)
            return Result<GetPromoCodeDto>.Ok(cached);

        var promoCode = await _promoCodeRepository.GetByIdAsync(id);
        if (promoCode == null)
            return Result<GetPromoCodeDto>.Fail("Promo code not found", ErrorType.NotFound);

        var dto = ToDto(promoCode);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetPromoCodeDto>.Ok(dto);
    }

    public async Task<Result<CreatePromoCodeResponseDto>> CreateAsync(CreatePromoCodeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
            return Result<CreatePromoCodeResponseDto>.Fail("Code is required", ErrorType.Validation);

        var exists = await _promoCodeRepository.ExistsByCodeAsync(dto.Code);
        if (exists)
            return Result<CreatePromoCodeResponseDto>.Fail("Promo code with the same code already exists", ErrorType.Conflict);

        var promoCode = new PromoCode
        {
            Code = dto.Code,
            DiscountType = dto.DiscountType,
            DiscountValue = dto.DiscountValue,
            MaxUsages = dto.MaxUsages,
            ValidFrom = dto.ValidFrom,
            ValidTo = dto.ValidTo
        };

        await _promoCodeRepository.AddAsync(promoCode);

        await ClearPromoCodesCacheAsync();

        _logger.LogInformation("Promo code created with ID: {Id}", promoCode.Id);

        return Result<CreatePromoCodeResponseDto>.Ok(new CreatePromoCodeResponseDto
        {
            Id = promoCode.Id,
            Code = promoCode.Code,
            DiscountType = promoCode.DiscountType,
            DiscountValue = promoCode.DiscountValue
        });
    }

    public async Task<Result<UpdatePromoCodeResponseDto>> UpdateAsync(Guid id, UpdatePromoCodeDto dto)
    {
        var promoCode = await _promoCodeRepository.GetByIdAsync(id);
        if (promoCode == null)
            return Result<UpdatePromoCodeResponseDto>.Fail("Promo code not found", ErrorType.NotFound);

        if (!string.Equals(promoCode.Code, dto.Code, StringComparison.OrdinalIgnoreCase))
        {
            var codeTaken = await _promoCodeRepository.ExistsByCodeAsync(dto.Code);
            if (codeTaken)
                return Result<UpdatePromoCodeResponseDto>.Fail("Promo code with the same code already exists", ErrorType.Conflict);
        }

        promoCode.Code = dto.Code;
        promoCode.DiscountType = dto.DiscountType;
        promoCode.DiscountValue = dto.DiscountValue;
        promoCode.MaxUsages = dto.MaxUsages;
        promoCode.ValidFrom = dto.ValidFrom;
        promoCode.ValidTo = dto.ValidTo;
        promoCode.IsActive = dto.IsActive;

        var success = await _promoCodeRepository.UpdateAsync(promoCode);
        if (!success)
            return Result<UpdatePromoCodeResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        await _cache.RemoveAsync($"PromoCode:{id}");
        await ClearPromoCodesCacheAsync();

        return Result<UpdatePromoCodeResponseDto>.Ok(new UpdatePromoCodeResponseDto
        {
            Id = promoCode.Id,
            Code = promoCode.Code,
            DiscountType = promoCode.DiscountType,
            DiscountValue = promoCode.DiscountValue,
            IsActive = promoCode.IsActive
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var promoCode = await _promoCodeRepository.GetByIdAsync(id);
        if (promoCode == null)
            return Result<bool>.Fail("Promo code not found", ErrorType.NotFound);

        await _promoCodeRepository.DeleteAsync(promoCode);

        await _cache.RemoveAsync($"PromoCode:{id}");
        await ClearPromoCodesCacheAsync();

        return Result<bool>.Ok(true);
    }

    private static GetPromoCodeDto ToDto(PromoCode promoCode) => new()
    {
        Id = promoCode.Id,
        Code = promoCode.Code,
        DiscountType = promoCode.DiscountType,
        DiscountValue = promoCode.DiscountValue,
        MaxUsages = promoCode.MaxUsages,
        UsedCount = promoCode.UsedCount,
        ValidFrom = promoCode.ValidFrom,
        ValidTo = promoCode.ValidTo,
        IsActive = promoCode.IsActive
    };

    private async Task<int> GetPromoCodesCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(PromoCodesCacheVersionKey);
        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearPromoCodesCacheAsync()
    {
        var nextVersion = await GetPromoCodesCacheVersionAsync() + 1;
        await _cache.SetStringAsync(PromoCodesCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation("Promo codes cache version incremented to {Version}", nextVersion);
    }
}
