using System.ComponentModel.DataAnnotations;

namespace Application.DTOs.Profile;

/// <summary>Удаление своего аккаунта: текущий пароль подтверждает, что это сам владелец.</summary>
public class DeleteAccountDto
{
    [Required(ErrorMessage = "Введите пароль")]
    [MaxLength(200)]
    public string Password { get; set; } = string.Empty;
}
