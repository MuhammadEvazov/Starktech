namespace Application.DTOs.Auth;

public class RegisterResponseDto
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public DateTime RegisteredAt { get; set; }
}
