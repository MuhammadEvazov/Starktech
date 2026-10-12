namespace Application.DTOs.AdminTelegramBinding;

public class ConfirmLinkDto
{
    public string Code { get; set; } = default!;
    public string TelegramChatId { get; set; } = default!;
}
