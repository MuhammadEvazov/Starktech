namespace Application.DTOs.User;

public class GetUserDto
{
    public string PhotoPath { get; set; } = string.Empty;
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public DateTime RegisterAt { get; set; }
    public string? AvatarUrl { get; set; }
}
