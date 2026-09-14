namespace Application.DTOs.AdminTelegramBinding;

public class GetAdminTelegramBindingDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? UserFullName { get; set; }
    public string TelegramChatId { get; set; } = default!;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
