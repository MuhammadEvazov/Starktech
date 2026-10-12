namespace Domain.Entities;

/// <summary>
/// Переписка клиента с магазином — одна на клиента. Счётчики непрочитанного нужны для бейджей
/// (у кнопки «Написать нам» и в меню админки), превью — для списка переписок.
/// </summary>
public class ChatConversation : BaseEntity
{
    public Guid CustomerId { get; set; }
    public User Customer { get; set; } = default!;

    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public string? LastMessagePreview { get; set; }
    public int UnreadByStaff { get; set; }
    public int UnreadByCustomer { get; set; }
    public bool IsClosed { get; set; }

    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
