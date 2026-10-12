namespace Application.Interfaces.Services;

public interface IJwtService
{
    (string Token, DateTime Expiration) GenerateToken(string userId, string email, List<string> roles);
}
