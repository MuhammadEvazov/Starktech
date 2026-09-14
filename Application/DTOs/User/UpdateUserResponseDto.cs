namespace Application.DTOs.User;

public class UpdateUserResponseDto
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public DateTime RegisterAt { get; set; }
}
