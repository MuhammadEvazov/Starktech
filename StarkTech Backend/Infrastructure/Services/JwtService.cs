using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Application.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Services;

public class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string Token, DateTime Expiration) GenerateToken(string userId, string email, List<string> roles, string? securityStamp = null)
    {
        var keyString = _configuration["JWT:Key"]
           ?? throw new InvalidOperationException("JWT:Key is missing in configuration.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId)
        };

        if (!string.IsNullOrEmpty(email))
            claims.Add(new Claim(ClaimTypes.Email, email));

        // Штамп безопасности сверяется при каждой проверке токена (Program.cs, OnTokenValidated):
        // смена пароля или роли меняет штамп, и старые токены перестают работать.
        if (!string.IsNullOrEmpty(securityStamp))
            claims.Add(new Claim(IJwtService.SecurityStampClaim, securityStamp));

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        if (!int.TryParse(_configuration["JWT:ExpireMinutes"], out var minutes) || minutes <= 0)
            throw new InvalidOperationException("JWT:ExpireMinutes is missing or invalid.");

        var expiration = DateTime.UtcNow.AddMinutes(minutes);

        var token = new JwtSecurityToken(
            issuer: _configuration["JWT:Issuer"],
            audience: _configuration["JWT:Audience"],
            claims: claims,
            expires: expiration,
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return (tokenString, expiration);
    }
}


