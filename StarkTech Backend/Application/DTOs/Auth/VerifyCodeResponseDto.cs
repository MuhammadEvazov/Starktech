namespace Application.DTOs.Auth;

public class VerifyCodeResponseDto
{
    /// <summary>Одноразовый токен для POST /api/auth/reset-password (поле resetToken).</summary>
    public string ResetToken { get; set; } = null!;
}
