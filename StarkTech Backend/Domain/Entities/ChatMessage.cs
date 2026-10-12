namespace Domain.Entities;

/// <summary>Сообщение чата: текст и/или фото, ответ на другое сообщение, правка, удаление, прочтение.</summary>
public class ChatMessage : BaseEntity
{
    public Guid ConversationId { get; set; }
    public ChatConversation Conversation { get; set; } = default!;

    /// <summary>Профиль отправителя (User.Id).</summary>
    public Guid SenderId { get; set; }
    public string SenderName { get; set; } = default!;
    public bool IsFromStaff { get; set; }

    public string? Text { get; set; }
    public string? AttachmentUrl { get; set; }

    public Guid? ReplyToId { get; set; }
    public ChatMessage? ReplyTo { get; set; }

    public DateTime? EditedAt { get; set; }
    public bool IsDeleted { get; set; }
    /// <summary>Когда собеседник прочитал сообщение (null — ещё не прочитано).</summary>
    public DateTime? ReadAt { get; set; }
}
