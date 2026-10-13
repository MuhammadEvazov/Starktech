using System.ComponentModel.DataAnnotations;

namespace Application.DTOs.Auth;

public class ResetPasswordDto
{
    [Required]
    public string Email { get; set; } = null!;

    /// <summary>Одноразовый токен из ответа verify-reset-code (живёт 10 минут).</summary>
    [Required(ErrorMessage = "Сначала подтвердите код из письма.")]
    public string ResetToken { get; set; } = null!;

    public string NewPassword { get; set; } = null!;
    [Compare("NewPassword", ErrorMessage = "Пароли не совпадают")]
    public string ConfirmPassword { get; set; } = null!;
}
