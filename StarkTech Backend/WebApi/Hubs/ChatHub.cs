using System.Collections.Concurrent;
using System.Security.Claims;
using Application.DTOs.Chat;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Hubs;

/// <summary>
/// Чат в реальном времени (/hubs/chat). Клиент сначала вызывает JoinConversation — после этого
/// ему доступны отправка, правка, удаление, «печатает…» и прочтение в этой переписке.
/// Сотрудник — пользователь с правом orders.view; сотрудники состоят в группе chat-staff.
/// </summary>
[Authorize]
public class ChatHub : Hub
{
    public const string StaffGroup = "chat-staff";
    public static string ConversationGroup(Guid id) => $"chat-{id}";

    // Кто сейчас онлайн (в пределах одного экземпляра сервера): id → число открытых подключений.
    private static readonly ConcurrentDictionary<Guid, int> OnlineProfiles = new();
    private static readonly ConcurrentDictionary<Guid, int> OnlineStaff = new();

    private readonly IChatService _chat;
    private readonly IUserRepository _users;
    private readonly IAuthorizationService _authorization;
    private readonly ChatNotifier _notifier;

    public ChatHub(IChatService chat, IUserRepository users, IAuthorizationService authorization, ChatNotifier notifier)
    {
        _chat = chat;
        _users = users;
        _authorization = authorization;
        _notifier = notifier;
    }

    private Guid ProfileId => Context.Items.TryGetValue("pid", out var v) && v is Guid g ? g : Guid.Empty;
    private bool IsStaff => Context.Items.TryGetValue("staff", out var v) && v is true;

    public static bool IsStaffOnline => !OnlineStaff.IsEmpty;
    public static bool IsProfileOnline(Guid profileId) => OnlineProfiles.ContainsKey(profileId);

    public override async Task OnConnectedAsync()
    {
        var appUserId = Context.UserIdentifier;
        if (string.IsNullOrEmpty(appUserId))
        {
            Context.Abort();
            return;
        }

        var profile = await _users.GetByIdAsync(appUserId);
        if (profile == null)
        {
            // Как в BaseController: учётной записи без профиля создаём профиль сразу.
            var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrWhiteSpace(email))
            {
                Context.Abort();
                return;
            }
            profile = Domain.Entities.User.Create(appUserId, email);
            await _users.AddAsync(profile);
        }

        var isStaff = Context.User != null &&
            (await _authorization.AuthorizeAsync(Context.User, PermissionPolicy.Prefix + UserPermissions.OrdersView)).Succeeded;

        Context.Items["pid"] = profile.Id;
        Context.Items["staff"] = isStaff;

        if (OnlineProfiles.AddOrUpdate(profile.Id, 1, (_, n) => n + 1) == 1)
            await Clients.Group(StaffGroup).SendAsync("Presence", new { profileId = profile.Id, online = true });

        if (isStaff)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, StaffGroup);
            if (OnlineStaff.AddOrUpdate(profile.Id, 1, (_, n) => n + 1) == 1)
                await Clients.All.SendAsync("StaffPresence", true);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var pid = ProfileId;
        if (pid != Guid.Empty)
        {
            if (Decrement(OnlineProfiles, pid))
                await Clients.Group(StaffGroup).SendAsync("Presence", new { profileId = pid, online = false });
            if (IsStaff && Decrement(OnlineStaff, pid))
                await Clients.All.SendAsync("StaffPresence", !OnlineStaff.IsEmpty);
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>true — это было последнее подключение пользователя.</summary>
    private static bool Decrement(ConcurrentDictionary<Guid, int> map, Guid id)
    {
        while (map.TryGetValue(id, out var n))
        {
            if (n <= 1)
            {
                if (map.TryRemove(new KeyValuePair<Guid, int>(id, n))) return true;
            }
            else if (map.TryUpdate(id, n - 1, n)) return false;
        }
        return false;
    }

    private ChatRole RoleIn(Guid conversationId)
        => Context.Items.TryGetValue("conv:" + conversationId, out var v) && v is ChatRole role
            ? role
            : throw new HubException("Сначала откройте переписку");

    // ── Методы, которые вызывает фронтенд ──

    public async Task<object> JoinConversation(Guid conversationId)
    {
        var role = await _chat.GetRoleAsync(conversationId, ProfileId, IsStaff)
            ?? throw new HubException("Нет доступа к переписке");

        Context.Items["conv:" + conversationId] = role;
        await Groups.AddToGroupAsync(Context.ConnectionId, ConversationGroup(conversationId));

        var conversation = (await _chat.GetConversationAsync(conversationId)).Data;
        return new
        {
            role = role.ToString(),
            staffOnline = IsStaffOnline,
            customerOnline = conversation != null && IsProfileOnline(conversation.CustomerId)
        };
    }

    public async Task LeaveConversation(Guid conversationId)
    {
        Context.Items.Remove("conv:" + conversationId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ConversationGroup(conversationId));
    }

    public async Task<ChatMessageDto> SendMessage(Guid conversationId, string? text, Guid? replyToId)
    {
        var role = RoleIn(conversationId);
        var result = await _chat.SendAsync(conversationId, ProfileId, role == ChatRole.Staff, text, null, replyToId);
        if (!result.IsSuccess || result.Data == null)
            throw new HubException(result.Errors.FirstOrDefault() ?? "Не удалось отправить");

        await _notifier.MessageCreatedAsync(result.Data);
        return result.Data;
    }

    public async Task<ChatMessageDto> EditMessage(Guid conversationId, Guid messageId, string? text)
    {
        RoleIn(conversationId);
        var result = await _chat.EditAsync(messageId, ProfileId, text);
        if (!result.IsSuccess || result.Data == null)
            throw new HubException(result.Errors.FirstOrDefault() ?? "Не удалось изменить");

        await _notifier.MessageUpdatedAsync(result.Data);
        return result.Data;
    }

    public async Task<ChatMessageDto> DeleteMessage(Guid conversationId, Guid messageId)
    {
        RoleIn(conversationId);
        var result = await _chat.DeleteAsync(messageId, ProfileId);
        if (!result.IsSuccess || result.Data == null)
            throw new HubException(result.Errors.FirstOrDefault() ?? "Не удалось удалить");

        await _notifier.MessageUpdatedAsync(result.Data);
        return result.Data;
    }

    public async Task Typing(Guid conversationId)
    {
        var role = RoleIn(conversationId);
        await Clients.OthersInGroup(ConversationGroup(conversationId))
            .SendAsync("Typing", new { conversationId, fromStaff = role == ChatRole.Staff });
    }

    public async Task MarkRead(Guid conversationId)
    {
        var role = RoleIn(conversationId);
        var result = await _chat.MarkReadAsync(conversationId, role == ChatRole.Staff);
        if (result.Data != null)
            await _notifier.MessagesReadAsync(result.Data);
    }

    /// <summary>Кто из клиентов онлайн — для точек в списке переписок у сотрудника.</summary>
    public IEnumerable<Guid> GetOnlineProfiles()
        => IsStaff ? OnlineProfiles.Keys.ToList() : Enumerable.Empty<Guid>();
}
