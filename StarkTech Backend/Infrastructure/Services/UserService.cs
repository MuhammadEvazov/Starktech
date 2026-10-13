using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.DTOs.User;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Extensions;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class UserService : IUserService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly IDistributedCache _cache;
    private readonly ILogger<UserService> _logger;

    private const string UsersCacheVersionKey = "Users:version";

    // Роли клиента: "User" выдаёт регистрация, "Client" — роль из сида (UserRole.Client)
    private static readonly string[] ClientRoles = { "User", "Client" };

    private static readonly string[] StaffRoles = { "Admin", "SuperAdmin" };

    private static readonly string[] AllowedRoles =
    {
        "User",
        "Client",
        "Admin"
    };

    public UserService(
        UserManager<AppUser> userManager,
        AppDbContext context,
        IFileService fileService,
        IDistributedCache cache,
        ILogger<UserService> logger)
    {
        _userManager = userManager;
        _context = context;
        _fileService = fileService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetUserDto>>> GetUsersAsync(GetUserFilterDto dto)
    {
        var page = dto.Page <= 0 ? 1 : dto.Page;
        var pageSize = dto.PageSize <= 0 ? 10 : dto.PageSize;

        var normalizedRole = string.IsNullOrWhiteSpace(dto.Role)
            ? null
            : NormalizeRole(dto.Role);

        if (!string.IsNullOrWhiteSpace(dto.Role) && normalizedRole == null)
            return Result<PageResult<GetUserDto>>.Fail("Invalid role", ErrorType.Validation);

        var cacheObject = new
        {
            dto.FullName,
            dto.Email,
            dto.Phone,
            dto.RegisteredFrom,
            dto.RegisteredTo,
            Role = normalizedRole,
            Page = page,
            PageSize = pageSize
        };

        var json = JsonSerializer.Serialize(cacheObject);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        var version = await GetUsersCacheVersionAsync();
        var key = $"Users:v{version}:{hash}";

        var cached = await _cache.GetAsync<PageResult<GetUserDto>>(key);
        if (cached != null)
            return Result<PageResult<GetUserDto>>.Ok(cached);

        try
        {
            var query =
                from user in _context.Users.AsNoTracking()
                join profile in _context.Clients.AsNoTracking()
                    on user.Id equals profile.AppUserId into profiles
                from profile in profiles.DefaultIfEmpty()
                // Удалённые по запросу владельца аккаунты в списках не показываем
                where profile == null || profile.DeletedAt == null
                select new
                {
                    User = user,
                    Profile = profile
                };

            if (!string.IsNullOrWhiteSpace(dto.FullName))
            {
                query = query.Where(x =>
                    x.Profile != null &&
                    x.Profile.FullName != null &&
                    x.Profile.FullName.Contains(dto.FullName));
            }

            if (!string.IsNullOrWhiteSpace(dto.Email))
            {
                query = query.Where(x =>
                    x.User.Email != null &&
                    x.User.Email.Contains(dto.Email));
            }

            if (!string.IsNullOrWhiteSpace(dto.Phone))
            {
                query = query.Where(x =>
                    x.User.PhoneNumber != null &&
                    x.User.PhoneNumber.Contains(dto.Phone));
            }

            if (dto.RegisteredFrom.HasValue)
            {
                var fromDate = DateTime.SpecifyKind(dto.RegisteredFrom.Value, DateTimeKind.Utc);

                query = query.Where(x =>
                    x.Profile != null &&
                    x.Profile.RegisterAt >= fromDate);
            }

            if (dto.RegisteredTo.HasValue)
            {
                var toDate = DateTime.SpecifyKind(dto.RegisteredTo.Value.AddDays(1), DateTimeKind.Utc);

                query = query.Where(x =>
                    x.Profile != null &&
                    x.Profile.RegisterAt < toDate);
            }

            if (!string.IsNullOrWhiteSpace(normalizedRole))
            {
                var roleId = await _context.Roles
                    .Where(r => r.Name == normalizedRole)
                    .Select(r => r.Id)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrWhiteSpace(roleId))
                {
                    var emptyPage = new PageResult<GetUserDto>(
                        new List<GetUserDto>(),
                        0,
                        page,
                        pageSize);

                    return Result<PageResult<GetUserDto>>.Ok(emptyPage);
                }

                query = query.Where(x =>
                    _context.UserRoles.Any(ur =>
                        ur.UserId == x.User.Id &&
                        ur.RoleId == roleId));
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(x => x.Profile != null ? x.Profile.RegisterAt : DateTime.MinValue)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = items.Select(x => x.User.Id).ToList();

            var rolesLookup = await _context.UserRoles
                .Where(ur => userIds.Contains(ur.UserId))
                .Join(
                    _context.Roles,
                    ur => ur.RoleId,
                    role => role.Id,
                    (ur, role) => new
                    {
                        ur.UserId,
                        RoleName = role.Name!
                    })
                .ToListAsync();

            var rolesByUserId = rolesLookup
                .ToLookup(x => x.UserId, x => x.RoleName);

            var resultList = items.Select(x => new GetUserDto
            {
                Id = x.User.Id,
                Email = x.User.Email ?? string.Empty,
                FullName = x.Profile?.FullName ?? string.Empty,
                PhoneNumber = x.User.PhoneNumber ?? string.Empty,
                RegisterAt = x.Profile?.RegisterAt ?? DateTime.UtcNow,
                AvatarUrl = x.Profile?.AvatarUrl ?? string.Empty,
                Roles = rolesByUserId[x.User.Id].ToList()
            }).ToList();

            var pageResult = new PageResult<GetUserDto>(
                resultList,
                totalCount,
                page,
                pageSize);

            await _cache.AddAsync(key, pageResult, DateTime.UtcNow.AddMinutes(5));

            return Result<PageResult<GetUserDto>>.Ok(pageResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while filtering Users");
            return Result<PageResult<GetUserDto>>.Fail("Error", ErrorType.Unknown);
        }
    }

    public async Task<Result<GetUserDto>> GetByIdAsync(string id)
    {
        var key = $"User:{id}";

        var cached = await _cache.GetAsync<GetUserDto>(key);
        if (cached != null)
            return Result<GetUserDto>.Ok(cached);

        var user = await _userManager.FindByIdAsync(id);

        if (user == null)
            return Result<GetUserDto>.Fail("User not found", ErrorType.NotFound);

        var profile = await _context.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.AppUserId == id);

        var roles = await _context.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(
                _context.Roles,
                ur => ur.RoleId,
                role => role.Id,
                (ur, role) => role.Name!)
            .ToListAsync();

        var dto = new GetUserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            FullName = profile?.FullName ?? string.Empty,
            PhoneNumber = user.PhoneNumber ?? string.Empty,
            RegisterAt = profile?.RegisterAt ?? DateTime.UtcNow,
            AvatarUrl = profile?.AvatarUrl ?? string.Empty,
            Roles = roles
        };

        await _cache.AddAsync(key, dto, DateTime.UtcNow.AddMinutes(10));

        return Result<GetUserDto>.Ok(dto);
    }

    public async Task<Result<UpdateUserResponseDto>> UpdateAsync(string id, UpdateUserDto dto)
    {
        var key = $"User:{id}";

        var user = await _userManager.FindByIdAsync(id);

        if (user == null)
            return Result<UpdateUserResponseDto>.Fail("User not found", ErrorType.NotFound);

        var profile = await GetOrCreateProfileAsync(id, dto.Email, dto.FullName);

        user.Email = dto.Email;
        user.UserName = dto.Email;
        user.PhoneNumber = dto.PhoneNumber;

        profile.UpdateProfile(dto.FullName, profile.Bio);

        var identityResult = await _userManager.UpdateAsync(user);

        if (!identityResult.Succeeded)
        {
            var errors = identityResult.Errors
                .Select(e => e.Description)
                .ToList();

            return Result<UpdateUserResponseDto>.Fail(errors, ErrorType.Validation);
        }

        await _context.SaveChangesAsync();

        await _cache.RemoveAsync(key);
        await ClearUsersCacheAsync();

        var response = new UpdateUserResponseDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            FullName = profile.FullName ?? string.Empty,
            PhoneNumber = user.PhoneNumber ?? string.Empty,
            RegisterAt = profile.RegisterAt
        };

        return Result<UpdateUserResponseDto>.Ok(response);
    }

    public async Task<bool> UpdateUserProfileAsync(string userId, IFormFile? file)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return false;

        var profile = await GetOrCreateProfileAsync(userId, user.Email ?? string.Empty);
        var previousAvatarUrl = profile.AvatarUrl;
        string? newFileUrl = null;

        if (file == null)
        {
            profile.ClearAvatar();
        }
        else
        {
            newFileUrl = await _fileService.UploadAsync(file, "profile");

            if (string.IsNullOrWhiteSpace(newFileUrl))
                return false;

            profile.UpdateAvatar(newFileUrl);
        }

        // Сначала сохраняем БД, и только потом удаляем старый файл.
        // Если запись не удалась — удаляем только что сохранённый новый файл.
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save avatar for user {UserId}", userId);
            if (newFileUrl != null)
                await _fileService.DeleteAsync(newFileUrl);
            return false;
        }

        if (!string.IsNullOrWhiteSpace(previousAvatarUrl) && previousAvatarUrl != newFileUrl)
            await _fileService.DeleteAsync(previousAvatarUrl);

        await _cache.RemoveAsync($"User:{userId}");
        await ClearUsersCacheAsync();

        return true;
    }

    public async Task<Result<bool>> DeleteAsync(string id)
    {
        var user = await _userManager.FindByIdAsync(id);

        if (user == null)
            return Result<bool>.Fail("User not found", ErrorType.NotFound);

        // Роли из сида: Client / Admin / SuperAdmin (регистрация исторически выдаёт "User").
        // Удалять через этот метод можно только клиентов — сотрудников с ролью Admin/SuperAdmin нельзя.
        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Any(r => StaffRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
            return Result<bool>.Fail("Сотрудника (Admin/SuperAdmin) нельзя удалить как клиента", ErrorType.Forbidden);

        try
        {
            var profile = await _context.Clients
                .FirstOrDefaultAsync(s => s.AppUserId == id);

            var avatarUrl = profile?.AvatarUrl;

            // Вложения чата клиента: переписка удаляется каскадом, файлы удаляем после коммита
            var attachmentUrls = profile == null
                ? new List<string>()
                : await _context.Set<ChatMessage>()
                    .Where(m => m.Conversation.CustomerId == profile.Id && m.AttachmentUrl != null)
                    .Select(m => m.AttachmentUrl!)
                    .ToListAsync();

            await using (var tx = await _context.Database.BeginTransactionAsync())
            {
                if (profile != null)
                {
                    _context.Clients.Remove(profile);
                    await _context.SaveChangesAsync();
                }

                var result = await _userManager.DeleteAsync(user);

                if (!result.Succeeded)
                {
                    await tx.RollbackAsync();

                    var errors = result.Errors
                        .Select(e => e.Description)
                        .ToList();

                    return Result<bool>.Fail(errors, ErrorType.Validation);
                }

                await tx.CommitAsync();
            }

            // Файлы — только после успешного коммита
            if (!string.IsNullOrWhiteSpace(avatarUrl))
                await _fileService.DeleteAsync(avatarUrl);

            foreach (var url in attachmentUrls)
                await _fileService.DeleteAsync(url);

            await _cache.RemoveAsync($"User:{id}");
            await ClearUsersCacheAsync();

            return Result<bool>.Ok(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while deleting User: {UserId}", id);
            return Result<bool>.Fail("Error while deleting User", ErrorType.Unknown);
        }
    }

    public async Task<List<UserDropdownDto>> GetAllForDropdownAsync()
    {
        var clientRoleIds = await _context.Roles
            .Where(r => r.Name != null && ClientRoles.Contains(r.Name))
            .Select(r => r.Id)
            .ToListAsync();

        if (clientRoleIds.Count == 0)
            return new List<UserDropdownDto>();

        var users = await (
            from user in _context.Users.AsNoTracking()
            join profile in _context.Clients.AsNoTracking()
                on user.Id equals profile.AppUserId into profiles
            from profile in profiles.DefaultIfEmpty()
            where profile == null || profile.DeletedAt == null
            where _context.UserRoles.Any(ur => ur.UserId == user.Id && clientRoleIds.Contains(ur.RoleId))
            select new
            {
                user.Id,
                user.UserName,
                user.Email,
                FullName = profile != null ? profile.FullName : null
            })
            .ToListAsync();

        return users
            .Select(user => new UserDropdownDto
            {
                Id = user.Id,
                FullName = string.IsNullOrWhiteSpace(user.FullName)
                    ? user.UserName ?? user.Email?.Split('@')[0] ?? "Unknown"
                    : user.FullName.Trim(),
                Email = user.Email ?? string.Empty
            })
            .OrderBy(s => s.FullName)
            .ToList();
    }

    public async Task<Result<bool>> AssignRoleAsync(string userId, string role)
    {
        var normalizedRole = NormalizeRole(role);

        if (normalizedRole == null)
            return Result<bool>.Fail("Invalid role", ErrorType.Validation);

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return Result<bool>.Fail("User not found", ErrorType.NotFound);

        var roleExists = await _context.Roles.AnyAsync(r => r.Name == normalizedRole);

        if (!roleExists)
            return Result<bool>.Fail("Role does not exist", ErrorType.NotFound);

        var alreadyHasRole = await _userManager.IsInRoleAsync(user, normalizedRole);

        if (alreadyHasRole)
            return Result<bool>.Ok(true);

        var result = await _userManager.AddToRoleAsync(user, normalizedRole);

        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToList();
            return Result<bool>.Fail(errors, ErrorType.Validation);
        }

        await _cache.RemoveAsync($"User:{userId}");
        await ClearUsersCacheAsync();

        return Result<bool>.Ok(true);
    }

    public async Task<Result<bool>> RemoveRoleAsync(string userId, string role)
    {
        var normalizedRole = NormalizeRole(role);

        if (normalizedRole == null)
            return Result<bool>.Fail("Invalid role", ErrorType.Validation);

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return Result<bool>.Fail("User not found", ErrorType.NotFound);

        var hasRole = await _userManager.IsInRoleAsync(user, normalizedRole);

        if (!hasRole)
            return Result<bool>.Ok(true);

        if (normalizedRole == "Admin")
        {
            var admins = await _userManager.GetUsersInRoleAsync("Admin");

            if (admins.Count <= 1 && admins.Any(x => x.Id == userId))
                return Result<bool>.Fail("Cannot remove the last Admin role", ErrorType.Forbidden);
        }

        var result = await _userManager.RemoveFromRoleAsync(user, normalizedRole);

        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToList();
            return Result<bool>.Fail(errors, ErrorType.Validation);
        }

        await _cache.RemoveAsync($"User:{userId}");
        await ClearUsersCacheAsync();

        return Result<bool>.Ok(true);
    }

    private async Task<User> GetOrCreateProfileAsync(string userId, string email, string? fullName = null)
    {
        var profile = await _context.Clients
            .FirstOrDefaultAsync(s => s.AppUserId == userId);

        if (profile != null)
            return profile;

        profile = User.Create(userId, email, fullName);

        await _context.Clients.AddAsync(profile);

        return profile;
    }

    private static string? NormalizeRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return null;

        return AllowedRoles.FirstOrDefault(x =>
            string.Equals(x, role.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private async Task<int> GetUsersCacheVersionAsync()
    {
        var value = await _cache.GetStringAsync(UsersCacheVersionKey);

        return int.TryParse(value, out var version) ? version : 0;
    }

    private async Task ClearUsersCacheAsync()
    {
        var nextVersion = await GetUsersCacheVersionAsync() + 1;

        await _cache.SetStringAsync(UsersCacheVersionKey, nextVersion.ToString());

        _logger.LogInformation(
            "Users cache version incremented to {Version}",
            nextVersion);
    }
}