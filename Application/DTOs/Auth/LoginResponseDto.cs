namespace Application.DTOs.Auth;

public class LoginResponseDto
{
    public string Token { get; set; } = null!;
    public DateTime Expiration { get; set; }

    public string Email { get; set; } = null!;
    public string UserId { get; set; } = null!;
}
