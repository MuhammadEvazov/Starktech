using Domain.Entities;

namespace Domain.Entities;

public class AdminTelegramBinding : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    public string TelegramChatId { get; set; } = default!;
    public bool IsActive { get; set; } = true;
}
