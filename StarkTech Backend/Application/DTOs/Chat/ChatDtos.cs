using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Application.DTOs.Chat;

/// <summary>Кем пользователь выступает в переписке: владелец-клиент или сотрудник магазина.</summary>
public enum ChatRole
{
    Customer,
    Staff
}

public class ChatConversationDto
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? CustomerAvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastMessageAt { get; set; }
    public string? LastMessagePreview { get; set; }
    public int UnreadByStaff { get; set; }
    public int UnreadByCustomer { get; set; }
    public bool IsClosed { get; set; }

    /// <summary>Identity-id клиента — нужен хабу, чтобы отправить событие лично ему. Наружу не отдаём.</summary>
    [JsonIgnore]
    public string CustomerAppUserId { get; set; } = string.Empty;
}

public class ChatReplyDto
{
    public Guid Id { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string? Text { get; set; }
    public bool HasAttachment { get; set; }
    public bool IsDeleted { get; set; }
}

public class ChatMessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public bool IsFromStaff { get; set; }
    public string? Text { get; set; }
    public string? AttachmentUrl { get; set; }
    public ChatReplyDto? ReplyTo { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? ReadAt { get; set; }
}

public class ChatReadDto
{
    public Guid ConversationId { get; set; }
    /// <summary>true — прочитал сотрудник (значит, прочитаны сообщения клиента).</summary>
    public bool ByStaff { get; set; }
    public DateTime ReadAt { get; set; }
}

public class SetChatClosedDto
{
    public bool Closed { get; set; }
}

public class ChatUnreadDto
{
    /// <summary>Непрочитанные сообщения клиентов — только для сотрудников, иначе null.</summary>
    public int? Staff { get; set; }
    /// <summary>Непрочитанные ответы магазина в собственной переписке.</summary>
    public int Mine { get; set; }
}
