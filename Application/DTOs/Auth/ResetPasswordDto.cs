using System.ComponentModel.DataAnnotations;

namespace Application.DTOs.Auth;

public class ResetPasswordDto
{
    [Required]
    public string Email { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
    [Compare("NewPassword", ErrorMessage = "Passwords do not match")]
    public string ConfirmPassword { get; set; } = null!;
}
