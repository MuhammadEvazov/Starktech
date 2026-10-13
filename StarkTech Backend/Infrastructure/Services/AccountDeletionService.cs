using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

/// <summary>
/// Удаление аккаунта по запросу владельца (право на удаление персональных данных).
/// Что происходит:
///  • сотрудникам (любая роль кроме клиентской) самоудаление запрещено;
///  • при незавершённых заказах удаление запрещено — магазину нужны контакты для доставки;
///  • заказы, позиции, оплаты, чеки и история монет остаются (учёт), но контакты и адрес в заказах стираются;
///  • фото клиента и макеты к заказам, переписка с магазином, аватар — удаляются (записи и файлы);
///  • отзывы остаются, автор показывается как «Удалённый пользователь»;
///  • профиль обезличивается, учётная запись Identity получает email-заглушку, теряет пароль,
///    блокируется навсегда, а новый штамп безопасности отзывает все выданные токены.
/// Всё в одной транзакции; файлы удаляются только после успешного коммита.
/// </summary>
public class AccountDeletionService : IAccountDeletionService
{
    private const string WrongPasswordMessage = "Неверный пароль";
    private const string StaffMessage = "Сотрудники не могут удалить аккаунт самостоятельно";
    private const string ActiveOrdersMessage = "Есть незавершённые заказы — дождитесь их выполнения или отмените их";

    // Клиентские роли: "User" выдаёт регистрация, "Client" — роль из сида.
    private static readonly string[] ClientRoles = { "User", "Client" };

    // Заказ завершён — его можно обезличить; в остальных статусах магазин ещё работает с клиентом.
    private static readonly OrderStatus[] FinishedStatuses = { OrderStatus.Delivered, OrderStatus.Cancelled };

    private const string UsersCacheVersionKey = "Users:version";

    private readonly UserManager<AppUser> _userManager;
    private readonly AppDbContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFileService _fileService;
    private readonly IDistributedCache _cache;
    private readonly ILogger<AccountDeletionService> _logger;

    public AccountDeletionService(
        UserManager<AppUser> userManager,
        AppDbContext context,
        IUnitOfWork unitOfWork,
        IFileService fileService,
        IDistributedCache cache,
        ILogger<AccountDeletionService> logger)
    {
        _userManager = userManager;
        _context = context;
        _unitOfWork = unitOfWork;
        _fileService = fileService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Result<string>> DeleteOwnAccountAsync(string appUserId, string password)
    {
        if (string.IsNullOrWhiteSpace(appUserId))
            return Result<string>.Fail("Пользователь не найден", ErrorType.Unauthorized);

        var appUser = await _userManager.FindByIdAsync(appUserId);
        if (appUser == null)
            return Result<string>.Fail("Пользователь не найден", ErrorType.Unauthorized);

        if (string.IsNullOrEmpty(password) || !await _userManager.CheckPasswordAsync(appUser, password))
            return Result<string>.Fail(WrongPasswordMessage, ErrorType.Validation);

        var roles = await _userManager.GetRolesAsync(appUser);
        if (roles.Any(r => !ClientRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
            return Result<string>.Fail(StaffMessage, ErrorType.Validation);

        var profile = await _context.Clients.FirstOrDefaultAsync(c => c.AppUserId == appUserId);
        if (profile != null && profile.Role != UserRole.Client)
            return Result<string>.Fail(StaffMessage, ErrorType.Validation);

        var filesToDelete = new List<string>();

        var result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            if (profile != null)
            {
                // Блокируем заказы клиента до конца транзакции: статус не поменяется между проверкой и обезличиванием.
                var orders = await _context.Orders
                    .FromSqlInterpolated($"SELECT * FROM \"Orders\" WHERE \"UserId\" = {profile.Id} FOR UPDATE")
                    .ToListAsync();

                if (orders.Any(o => !FinishedStatuses.Contains(o.Status)))
                    return Result<string>.Fail(ActiveOrdersMessage, ErrorType.Validation);

                var orderIds = orders.Select(o => o.Id).ToList();

                // Заказы остаются (номер, суммы, оплаты), контакты и адрес — стираются.
                foreach (var order in orders)
                {
                    order.ContactName = User.DeletedUserName;
                    order.ContactPhone = string.Empty;
                    order.ContactEmail = null;
                    order.DeliveryAddress = null;
                    order.UpdatedAt = DateTime.UtcNow;
                }

                // Фото клиента к позициям: записи и файлы удаляем (в учёте они не нужны).
                var photos = await _context.OrderItemPhotos
                    .Where(p => orderIds.Contains(p.OrderItem.OrderId))
                    .ToListAsync();
                foreach (var photo in photos)
                {
                    filesToDelete.Add(photo.OriginalPhotoUrl);
                    if (!string.IsNullOrWhiteSpace(photo.EditedPreviewUrl))
                        filesToDelete.Add(photo.EditedPreviewUrl);
                }
                _context.OrderItemPhotos.RemoveRange(photos);

                // Макеты собраны из фото клиента и содержат его комментарии — тоже удаляем.
                var layouts = await _context.Set<OrderLayout>()
                    .Where(l => orderIds.Contains(l.OrderId))
                    .ToListAsync();
                filesToDelete.AddRange(layouts.Select(l => l.ImageUrl));
                _context.Set<OrderLayout>().RemoveRange(layouts);

                // Переписка с магазином: сообщения удаляются каскадом, вложения — после коммита.
                var conversations = await _context.Set<ChatConversation>()
                    .Where(c => c.CustomerId == profile.Id)
                    .ToListAsync();
                var conversationIds = conversations.Select(c => c.Id).ToList();
                var attachmentUrls = await _context.Set<ChatMessage>()
                    .Where(m => conversationIds.Contains(m.ConversationId) && m.AttachmentUrl != null)
                    .Select(m => m.AttachmentUrl!)
                    .ToListAsync();
                filesToDelete.AddRange(attachmentUrls);
                _context.Set<ChatConversation>().RemoveRange(conversations);

                // Привязка Telegram (на случай, если осталась от бывшей роли сотрудника).
                var bindings = await _context.AdminTelegramBindings
                    .Where(b => b.UserId == profile.Id)
                    .ToListAsync();
                _context.AdminTelegramBindings.RemoveRange(bindings);

                if (!string.IsNullOrWhiteSpace(profile.AvatarUrl))
                    filesToDelete.Add(profile.AvatarUrl);

                var tombstone = $"deleted-{Guid.NewGuid():N}@deleted.local";
                profile.Anonymize(tombstone);

                await _context.SaveChangesAsync();

                return await AnonymizeIdentityAsync(appUser, tombstone);
            }

            return await AnonymizeIdentityAsync(appUser, $"deleted-{Guid.NewGuid():N}@deleted.local");
        });

        if (!result.IsSuccess)
            return result;

        // Файлы — только после успешного коммита: при откате ничего не потеряем.
        foreach (var url in filesToDelete.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct())
        {
            try
            {
                await _fileService.DeleteAsync(url);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete a file of deleted account {ProfileId}", profile?.Id);
            }
        }

        await InvalidateUserCachesAsync(appUserId);

        _logger.LogWarning("Account self-deleted: profile {ProfileId}", profile?.Id);

        return Result<string>.Ok("Аккаунт удалён");
    }

    private async Task<Result<string>> AnonymizeIdentityAsync(AppUser appUser, string tombstone)
    {
        // Внешние входы, токены и клеймы учётной записи больше не нужны.
        _context.UserLogins.RemoveRange(await _context.UserLogins.Where(x => x.UserId == appUser.Id).ToListAsync());
        _context.UserTokens.RemoveRange(await _context.UserTokens.Where(x => x.UserId == appUser.Id).ToListAsync());
        _context.UserClaims.RemoveRange(await _context.UserClaims.Where(x => x.UserId == appUser.Id).ToListAsync());

        appUser.Email = tombstone;
        appUser.UserName = tombstone;
        appUser.NormalizedEmail = _userManager.NormalizeEmail(tombstone);
        appUser.NormalizedUserName = _userManager.NormalizeName(tombstone);
        appUser.EmailConfirmed = false;
        appUser.PhoneNumber = null;
        appUser.PhoneNumberConfirmed = false;
        appUser.PasswordHash = null;
        appUser.TwoFactorEnabled = false;
        appUser.LockoutEnabled = true;
        appUser.LockoutEnd = DateTimeOffset.MaxValue;

        var update = await _userManager.UpdateAsync(appUser);
        if (!update.Succeeded)
        {
            _logger.LogError("Identity anonymization failed for user {UserId}: {Errors}",
                appUser.Id, string.Join("; ", update.Errors.Select(e => e.Code)));
            return Result<string>.Fail("Не удалось удалить аккаунт. Попробуйте позже.", ErrorType.ServerError);
        }

        // Новый штамп безопасности — все выданные JWT перестают проходить проверку (OnTokenValidated).
        var stamp = await _userManager.UpdateSecurityStampAsync(appUser);
        if (!stamp.Succeeded)
            return Result<string>.Fail("Не удалось удалить аккаунт. Попробуйте позже.", ErrorType.ServerError);

        return Result<string>.Ok("Аккаунт удалён");
    }

    private async Task InvalidateUserCachesAsync(string appUserId)
    {
        try
        {
            await _cache.RemoveAsync($"User:{appUserId}");

            var current = await _cache.GetStringAsync(UsersCacheVersionKey);
            var next = (int.TryParse(current, out var version) ? version : 0) + 1;
            await _cache.SetStringAsync(UsersCacheVersionKey, next.ToString());
        }
        catch (Exception ex)
        {
            // Кэш списков пользователей вторичен — данные уже удалены.
            _logger.LogWarning(ex, "Failed to invalidate user caches after account deletion");
        }
    }
}
