using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.DeliveryCity;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Extensions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class DeliveryCityService : IDeliveryCityService
{
    private readonly IDeliveryCityRepository _cityRepository;
    private readonly IDistributedCache _cache;
    private readonly ILogger<DeliveryCityService> _logger;

    private const string CitiesCacheVersionKey = "DeliveryCities:version";

    public DeliveryCityService(
        IDeliveryCityRepository cityRepository,
        IDistributedCache cache,
        ILogger<DeliveryCityService> logger)
    {
        _cityRepository = cityRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetDeliveryCityDto>>> GetAllAsync(GetDeliveryCityFilterDto filter)
    {
        var version = await GetCitiesCacheVersionAsync();

        var json = JsonSerializer.Serialize(filter);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var key = $"DeliveryCities:v{version}:{hash}";

        var cached = await _cache.GetAsync<PageResult<GetDeliveryCityDto>>(key);
        if (cached != null)
        {
            _logger.LogInformation("Cache HIT for key: {Key}", key);
            return Result<PageResult<GetDeliveryCityDto>>.Ok(cached);
        }

        _logger.LogInformation("Cache MISS for key: {Key}", key);

        var cities = await _cityRepository.GetAllAsync(filter);

        var items = cities.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetDeliveryCityDto>(
            items,
            cities.TotalCount,
            cities.Page,
            cities.PageSize);

        await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

        return Result<PageResult<GetDeliveryCityDto>>.Ok(pageResult);
    }

    public async Task<Result<GetDeliveryCityDto>> GetByIdAsync(Guid id)
    {
        var key = $"DeliveryCity:{id}";

        var cached = await _cache.GetAsync<GetDeliveryCityDto>(key);
        if (cached != null)
            return Result<GetDeliveryCityDto>.Ok(cached);

        var city = await _cityRepository.GetByIdAsync(id);
        if (city == null)
            return Result<GetDeliveryCityDto>.Fail("Delivery city not found", ErrorType.NotFound);

        var dto = ToDto(city);

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetDeliveryCityDto>.Ok(dto);
    }

    public async Task<Result<CreateDeliveryCityResponseDto>> CreateAsync(CreateDeliveryCityDto dto)
    {
        var city = new DeliveryCity
        {
            NameRu = dto.NameRu,
            NameTj = dto.NameTj,
            NameEn = dto.NameEn,
            DeliveryCost = dto.DeliveryCost
        };

        await _cityRepository.AddAsync(city);

        await ClearCitiesCacheAsync();

        _logger.LogInformation("Delivery city created with ID: {Id}", city.Id);

        return Result<CreateDeliveryCityResponseDto>.Ok(new CreateDeliveryCityResponseDto
        {
            Id = city.Id,
            NameRu = city.NameRu,
            NameTj = city.NameTj,
            NameEn = city.NameEn,
            DeliveryCost = city.DeliveryCost
        });
    }

    public async Task<Result<UpdateDeliveryCityResponseDto>> UpdateAsync(Guid id, UpdateDeliveryCityDto dto)
    {
        var city = await _cityRepository.GetByIdAsync(id);
        if (city == null)
            return Result<UpdateDeliveryCityResponseDto>.Fail("Delivery city not found", ErrorType.NotFound);

        city.NameRu = dto.NameRu;
        city.NameTj = dto.NameTj;
        city.NameEn = dto.NameEn;
        city.DeliveryCost = dto.DeliveryCost;
        city.IsActive = dto.IsActive;

        var success = await _cityRepository.UpdateAsync(city);
        if (!success)
            return Result<UpdateDeliveryCityResponseDto>.Fail("Update failed due to server error", ErrorType.Unknown);

        await _cache.RemoveAsync($"DeliveryCity:{id}");
        await ClearCitiesCacheAsync();

        return Result<UpdateDeliveryCityResponseDto>.Ok(new UpdateDeliveryCityResponseDto
        {
            Id = city.Id,
            NameRu = city.NameRu,
            NameTj = city.NameTj,
            NameEn = city.NameEn,
            DeliveryCost = city.DeliveryCost,
            IsActive = city.IsActive
        });
    }

    public async Task<Result<bool>> DeleteAsync(Guid id)
    {
        var city = await _cityRepository.GetByIdAsync(id);
        if (city == null)
            return Result<bool>.Fail("Delivery city not found", ErrorType.NotFound);

        await _cityRepository.DeleteAsync(city);

        await _cache.RemoveAsync($"DeliveryCity:{id}");
        await ClearCitiesCacheAsync();

        return Result<bool>.Ok(true);
    }

    private static GetDeliveryCityDto ToDto(DeliveryCity city) => new()
    {
        Id = city.Id,
        NameRu = city.NameRu,
        NameTj = city.NameTj,
        NameEn = city.NameEn,
        DeliveryCost = city.DeliveryCost,
        IsActive = city.IsActive
    };

    private async Task<int> GetCitiesCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(CitiesCacheVersionKey);
        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearCitiesCacheAsync()
    {
        var nextVersion = await GetCitiesCacheVersionAsync() + 1;
        await _cache.SetStringAsync(CitiesCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation("Delivery cities cache version incremented to {Version}", nextVersion);
    }
}
