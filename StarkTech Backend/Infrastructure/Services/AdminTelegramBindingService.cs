using Application.DTOs.AdminTelegramBinding;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class AdminTelegramBindingService : IAdminTelegramBindingService
{
    private readonly IAdminTelegramBindingRepository _bindingRepository;
    private readonly IUserRepository _userRepository;
    private readonly IDistributedCache _cache;
    private readonly ILogger<AdminTelegramBindingService> _logger;

    private static readonly TimeSpan LinkCodeTtl = TimeSpan.FromMinutes(10);
    private const int MaxConfirmAttempts = 5;

    public AdminTelegramBindingService(
        IAdminTelegramBindingRepository bindingRepository,
        IUserRepository userRepository,
        IDistributedCache cache,
        ILogger<AdminTelegramBindingService> logger)
    {
        _bindingRepository = bindingRepository;
        _userRepository = userRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetAdminTelegramBindingDto>>> GetAllAsync(GetAdminTelegramBindingFilterDto filter)
    {
        var bindings = await _bindingRepository.GetAllAsync(filter);

        var items = bindings.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetAdminTelegramBindingDto>(
            items,
            bindings.TotalCount,
            bindings.Page,
            bindings.PageSize);

        return Result<PageResult<GetAdminTelegramBindingDto>>.Ok(pageResult);
    }

    public async Task<Result<GetAdminTelegramBindingDto>> GetByIdAsync(Guid id)
    {
        var binding = await _bindingRepository.GetByIdAsync(id);
        if (binding == null)
            return Result<GetAdminTelegramBindingDto>.Fail("Binding not found", ErrorType.NotFound);

        return Result<GetAdminTelegramBindingDto>.Ok(ToDto(binding));
    }

    public async Task<Result<InitiateLinkResponseDto>> InitiateLinkAsync(InitiateLinkDto dto)
    {
        if (!await _userRepository.ExistsAsync(dto.UserId))
            return Result<InitiateLinkResponseDto>.Fail("User not found", ErrorType.NotFound);

        var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();
        var key = LinkCodeKey(code);

        await _cache.SetStringAsync(key, dto.UserId.ToString(), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = LinkCodeTtl
        });

        _logger.LogInformation("Telegram link code issued for user {UserId}", dto.UserId);

        return Result<InitiateLinkResponseDto>.Ok(new InitiateLinkResponseDto
        {
            Code = code,
            ExpiresAt = DateTime.UtcNow.Add(LinkCodeTtl)
        });
    }

    public async Task<Result<GetAdminTelegramBindingDto>> ConfirmLinkAsync(ConfirmLinkDto dto, string? callerId = null)
    {
        // Не больше MaxConfirmAttempts неверных кодов за окно LinkCodeTtl с одного аккаунта (и с одного chatId) —
        // перебрать 6-значный код не получится.
        var attemptKeys = new[]
        {
            $"TelegramLinkAttempts:caller:{callerId ?? "anonymous"}",
            $"TelegramLinkAttempts:chat:{dto.TelegramChatId}"
        };

        foreach (var attemptKey in attemptKeys)
        {
            if (int.TryParse(await _cache.GetStringAsync(attemptKey), out var n) && n >= MaxConfirmAttempts)
                return Result<GetAdminTelegramBindingDto>.Fail(
                    "Слишком много неверных кодов. Подождите 10 минут и запросите новый код.", ErrorType.Validation);
        }

        var key = LinkCodeKey((dto.Code ?? string.Empty).Trim());
        var userIdString = string.IsNullOrWhiteSpace(dto.Code) ? null : await _cache.GetStringAsync(key);

        if (userIdString == null || !Guid.TryParse(userIdString, out var userId))
        {
            foreach (var attemptKey in attemptKeys)
            {
                var current = int.TryParse(await _cache.GetStringAsync(attemptKey), out var n) ? n : 0;
                await _cache.SetStringAsync(attemptKey, (current + 1).ToString(), new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = LinkCodeTtl
                });
            }

            _logger.LogWarning("Invalid Telegram link code attempt by {CallerId}", callerId);
            return Result<GetAdminTelegramBindingDto>.Fail("Неверный или просроченный код.", ErrorType.Validation);
        }

        var existingByChatId = await _bindingRepository.GetByChatIdAsync(dto.TelegramChatId);
        if (existingByChatId != null && existingByChatId.UserId != userId)
            return Result<GetAdminTelegramBindingDto>.Fail("This Telegram account is already linked to another user", ErrorType.Conflict);

        var binding = await _bindingRepository.GetByUserIdAsync(userId);

        if (binding != null)
        {
            binding.TelegramChatId = dto.TelegramChatId;
            binding.IsActive = true;
            await _bindingRepository.UpdateAsync(binding);
        }
        else
        {
            binding = new AdminTelegramBinding
            {
                UserId = userId,
                TelegramChatId = dto.TelegramChatId,
                IsActive = true
            };

            await _bindingRepository.AddAsync(binding);
        }

        await _cache.RemoveAsync(key);

        _logger.LogInformation("Telegram binding confirmed for user {UserId}", userId);

        return Result<GetAdminTelegramBindingDto>.Ok(ToDto(binding));
    }

    public async Task<Result<bool>> UnlinkAsync(Guid userId)
    {
        var binding = await _bindingRepository.GetByUserIdAsync(userId);
        if (binding == null)
            return Result<bool>.Fail("Binding not found", ErrorType.NotFound);

        if (binding.IsActive)
        {
            binding.IsActive = false;
            await _bindingRepository.UpdateAsync(binding);
        }

        return Result<bool>.Ok(true);
    }

    private static string LinkCodeKey(string code) => $"TelegramLink:{code}";

    private static GetAdminTelegramBindingDto ToDto(AdminTelegramBinding binding) => new()
    {
        Id = binding.Id,
        UserId = binding.UserId,
        UserFullName = binding.User?.FullName,
        TelegramChatId = binding.TelegramChatId,
        IsActive = binding.IsActive,
        CreatedAt = binding.CreatedAt
    };
}
