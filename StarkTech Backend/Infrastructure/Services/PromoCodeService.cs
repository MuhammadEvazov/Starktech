using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.PromoCode;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Common;
using Domain.Entities;
using Domain.Enums;
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
            return Result<GetPromoCodeDto>.Fail("Промокод не найден.", ErrorType.NotFound);

        var dto = ToDto(promoCode);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetPromoCodeDto>.Ok(dto);
    }

    public async Task<Result<CreatePromoCodeResponseDto>> CreateAsync(CreatePromoCodeDto dto)
    {
        var code = NormalizeCode(dto.Code);
        var validationError = ValidatePromo(code, dto.DiscountType, dto.DiscountValue,
            dto.MaxUsages, dto.MaxUsagesPerUser, dto.ValidFrom, dto.ValidTo);
        if (validationError != null)
            return Result<CreatePromoCodeResponseDto>.Fail(validationError, ErrorType.Validation);

        var exists = await _promoCodeRepository.ExistsByCodeAsync(code);
        if (exists)
            return Result<CreatePromoCodeResponseDto>.Fail("Промокод с таким кодом уже есть.", ErrorType.Conflict);

        var promoCode = new PromoCode
        {
            Code = code,
            DiscountType = dto.DiscountType,
            DiscountValue = dto.DiscountValue,
            MaxUsages = dto.MaxUsages,
            MaxUsagesPerUser = dto.MaxUsagesPerUser,
            // Из формы админки приходит местное время Душанбе — в базе храним UTC.
            ValidFrom = ToUtc(dto.ValidFrom),
            ValidTo = ToUtc(dto.ValidTo)
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
            return Result<UpdatePromoCodeResponseDto>.Fail("Промокод не найден.", ErrorType.NotFound);

        var code = NormalizeCode(dto.Code);
        var validationError = ValidatePromo(code, dto.DiscountType, dto.DiscountValue,
            dto.MaxUsages, dto.MaxUsagesPerUser, dto.ValidFrom, dto.ValidTo);
        if (validationError != null)
            return Result<UpdatePromoCodeResponseDto>.Fail(validationError, ErrorType.Validation);

        if (await _promoCodeRepository.ExistsByCodeAsync(code, excludeId: id))
            return Result<UpdatePromoCodeResponseDto>.Fail("Промокод с таким кодом уже есть.", ErrorType.Conflict);

        promoCode.Code = code;
        promoCode.DiscountType = dto.DiscountType;
        promoCode.DiscountValue = dto.DiscountValue;
        promoCode.MaxUsages = dto.MaxUsages;
        promoCode.MaxUsagesPerUser = dto.MaxUsagesPerUser;
        promoCode.ValidFrom = ToUtc(dto.ValidFrom);
        promoCode.ValidTo = ToUtc(dto.ValidTo);
        promoCode.IsActive = dto.IsActive;

        var success = await _promoCodeRepository.UpdateAsync(promoCode);
        if (!success)
            return Result<UpdatePromoCodeResponseDto>.Fail("Не удалось сохранить промокод.", ErrorType.Unknown);

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

    public async Task<Result<PromoCodeValidationDto>> ValidateAsync(string code, Guid? userProfileId)
    {
        static Result<PromoCodeValidationDto> Fail(string message)
            => Result<PromoCodeValidationDto>.Fail(message, ErrorType.Validation);

        if (string.IsNullOrWhiteSpace(code))
            return Fail("Введите промокод.");

        // Без кэша: лимиты и счётчик использований должны быть актуальными.
        var promo = await _promoCodeRepository.GetByCodeAsync(code);

        if (promo == null || !promo.IsActive)
            return Fail("Такого промокода нет или он больше не действует.");

        var now = DateTime.UtcNow;

        if (promo.ValidFrom.HasValue && promo.ValidFrom.Value > now)
            return Fail($"Промокод начнёт действовать {ShopClock.ToLocal(promo.ValidFrom.Value):dd.MM.yyyy HH:mm}.");

        if (promo.ValidTo.HasValue && promo.ValidTo.Value < now)
            return Fail("Срок действия промокода истёк.");

        if (promo.MaxUsages.HasValue && promo.UsedCount >= promo.MaxUsages.Value)
            return Fail("Промокод уже использован максимальное число раз.");

        if (promo.MaxUsagesPerUser.HasValue && userProfileId.HasValue)
        {
            var used = await _promoCodeRepository.CountUserUsagesAsync(promo.Id, userProfileId.Value);
            if (used >= promo.MaxUsagesPerUser.Value)
                return Fail(promo.MaxUsagesPerUser.Value == 1
                    ? "Вы уже использовали этот промокод."
                    : $"Вы уже использовали этот промокод {used} раз — это максимум для одного клиента.");
        }

        return Result<PromoCodeValidationDto>.Ok(new PromoCodeValidationDto
        {
            Id = promo.Id,
            Code = promo.Code,
            DiscountType = promo.DiscountType,
            DiscountValue = promo.DiscountValue
        });
    }

    // Код храним в верхнем регистре без пробелов по краям: «summer10» и «SUMMER10 » — один промокод.
    private static string NormalizeCode(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    private static DateTime? ToUtc(DateTime? value) => value.HasValue ? ShopClock.FromLocal(value.Value) : null;

    private static string? ValidatePromo(string code, DiscountType type, decimal value,
        int? maxUsages, int? maxUsagesPerUser, DateTime? validFrom, DateTime? validTo)
    {
        if (code.Length == 0)
            return "Укажите код промокода.";
        if (code.Length > 50)
            return "Код промокода — не длиннее 50 символов.";
        if (code.Any(char.IsWhiteSpace))
            return "Код промокода не должен содержать пробелов.";
        if (!Enum.IsDefined(type))
            return "Неизвестный тип скидки.";
        if (type == DiscountType.Percent && (value <= 0 || value > 100))
            return "Скидка в процентах должна быть больше 0 и не больше 100.";
        if (type == DiscountType.FixedAmount && value <= 0)
            return "Сумма скидки должна быть больше 0.";
        if (maxUsages.HasValue && maxUsages.Value < 1)
            return "Лимит использований — целое число от 1 или пусто.";
        if (maxUsagesPerUser.HasValue && maxUsagesPerUser.Value < 1)
            return "Лимит на одного клиента — целое число от 1 или пусто.";
        if (validFrom.HasValue && validTo.HasValue && ToUtc(validTo) < ToUtc(validFrom))
            return "Дата окончания не может быть раньше даты начала.";
        return null;
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var promoCode = await _promoCodeRepository.GetByIdAsync(id);
        if (promoCode == null)
            return Result<bool>.Fail("Промокод не найден.", ErrorType.NotFound);

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
        MaxUsagesPerUser = promoCode.MaxUsagesPerUser,
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
