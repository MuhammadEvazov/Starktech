using System.ComponentModel.DataAnnotations;
using Application.Validation;

namespace Application.DTOs.Auth;

public class RegisterDto
{
    [Required]
    [MaxLength(100)]
    [PersonName]
    public string FullName { get; set; } = string.Empty;
    [Required]
    [MaxLength(100)]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [PhoneNumberFormat]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Compare("Password", ErrorMessage = "Passwords do not match")]
    public string ConfirmPassword { get; set; } = null!;
}
