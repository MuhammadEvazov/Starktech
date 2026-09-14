namespace Application.DTOs.Auth;

public class UserRolesViewModels
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public List<string> CurrentRoles { get; set; } = new List<string>();
    public List<string> AllAvailableRoles { get; set; } = new List<string>();
}
