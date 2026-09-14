namespace Application.DTOs.AdminTelegramBinding;

public class InitiateLinkResponseDto
{
    public string Code { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
}
