using Application.DTOs.Chat;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.SignalR;

namespace WebApi.Hubs;

/// <summary>
/// Рассылает события чата: сообщения — всем, кто открыл переписку (группа chat-{id});
/// обновление переписки (превью, счётчики) — сотрудникам и лично клиенту, даже если чат у него закрыт.
/// Рассылка — «по возможности»: данные уже сохранены, поэтому сбой SignalR только логируется
/// и не превращает успешный запрос в ошибку 500.
/// </summary>
public class ChatNotifier
{
    private readonly IHubContext<ChatHub> _hub;
    private readonly IChatService _chat;
    private readonly ILogger<ChatNotifier> _logger;

    public ChatNotifier(IHubContext<ChatHub> hub, IChatService chat, ILogger<ChatNotifier> logger)
    {
        _hub = hub;
        _chat = chat;
        _logger = logger;
    }

    public Task MessageCreatedAsync(ChatMessageDto message) => SafeAsync(async () =>
    {
        await _hub.Clients.Group(ChatHub.ConversationGroup(message.ConversationId)).SendAsync("MessageReceived", message);
        await SendConversationAsync(message.ConversationId);
    }, message.ConversationId);

    public Task MessageUpdatedAsync(ChatMessageDto message) => SafeAsync(async () =>
    {
        await _hub.Clients.Group(ChatHub.ConversationGroup(message.ConversationId)).SendAsync("MessageUpdated", message);
        await SendConversationAsync(message.ConversationId);
    }, message.ConversationId);

    public Task MessagesReadAsync(ChatReadDto read) => SafeAsync(async () =>
    {
        await _hub.Clients.Group(ChatHub.ConversationGroup(read.ConversationId)).SendAsync("MessagesRead", read);
        await SendConversationAsync(read.ConversationId);
    }, read.ConversationId);

    public Task ConversationChangedAsync(Guid conversationId)
        => SafeAsync(() => SendConversationAsync(conversationId), conversationId);

    public Task ConversationChangedAsync(ChatConversationDto conversation)
        => SafeAsync(() => SendConversationAsync(conversation), conversation.Id);

    private async Task SendConversationAsync(Guid conversationId)
    {
        var result = await _chat.GetConversationAsync(conversationId);
        if (result.Data is { } conversation)
            await SendConversationAsync(conversation);
    }

    private async Task SendConversationAsync(ChatConversationDto conversation)
    {
        await _hub.Clients.Group(ChatHub.StaffGroup).SendAsync("ConversationUpdated", conversation);
        if (!string.IsNullOrEmpty(conversation.CustomerAppUserId))
            await _hub.Clients.User(conversation.CustomerAppUserId).SendAsync("ConversationUpdated", conversation);
    }

    private async Task SafeAsync(Func<Task> action, Guid conversationId)
    {
        try
        {
            await action();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat notification for conversation {ConversationId} failed", conversationId);
        }
    }
}
