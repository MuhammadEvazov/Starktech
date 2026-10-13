namespace Application.Interfaces.Services;

public interface IJwtService
{
    /// <summary>Имя claim'а со штампом безопасности: токен отзывается, когда штамп у пользователя меняется.</summary>
    public const string SecurityStampClaim = "sstamp";

    (string Token, DateTime Expiration) GenerateToken(string userId, string email, List<string> roles, string? securityStamp = null);
}
