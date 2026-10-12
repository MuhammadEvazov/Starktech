using Application.DTOs.Chat;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.SignalR;

namespace WebApi.Hubs;

/// <summary>
/// Рассылает события чата: сообщения — всем, кто открыл переписку (группа chat-{id});
/// обновление переписки (превью, счётчики) — сотрудникам и лично клиенту, даже если чат у него закрыт.
/// </summary>
public class ChatNotifier
{
    private readonly IHubContext<ChatHub> _hub;
    private readonly IChatService _chat;

    public ChatNotifier(IHubContext<ChatHub> hub, IChatService chat)
    {
        _hub = hub;
        _chat = chat;
    }

    public async Task MessageCreatedAsync(ChatMessageDto message)
    {
        await _hub.Clients.Group(ChatHub.ConversationGroup(message.ConversationId)).SendAsync("MessageReceived", message);
        await ConversationChangedAsync(message.ConversationId);
    }

    public async Task MessageUpdatedAsync(ChatMessageDto message)
    {
        await _hub.Clients.Group(ChatHub.ConversationGroup(message.ConversationId)).SendAsync("MessageUpdated", message);
        await ConversationChangedAsync(message.ConversationId);
    }

    public async Task MessagesReadAsync(ChatReadDto read)
    {
        await _hub.Clients.Group(ChatHub.ConversationGroup(read.ConversationId)).SendAsync("MessagesRead", read);
        await ConversationChangedAsync(read.ConversationId);
    }

    public async Task ConversationChangedAsync(Guid conversationId)
    {
        var result = await _chat.GetConversationAsync(conversationId);
        if (result.Data is { } conversation)
            await ConversationChangedAsync(conversation);
    }

    public async Task ConversationChangedAsync(ChatConversationDto conversation)
    {
        await _hub.Clients.Group(ChatHub.StaffGroup).SendAsync("ConversationUpdated", conversation);
        if (!string.IsNullOrEmpty(conversation.CustomerAppUserId))
            await _hub.Clients.User(conversation.CustomerAppUserId).SendAsync("ConversationUpdated", conversation);
    }
}
