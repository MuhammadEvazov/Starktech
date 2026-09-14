using Domain.Enums;

namespace Domain.Entities;

public class User : BaseEntity
{
    public string AppUserId { get; set; } = default!; // FK на Identity AppUser.Id

    public string FullName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public UserRole Role { get; set; } = UserRole.Client;
    public Language PreferredLanguage { get; set; } = Language.Ru;
    public int CoinsBalance { get; set; } = 0;
    public bool EmailConfirmed { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public string? Bio { get; private set; }
    public string? AvatarUrl { get; private set; }

    public DateTime RegisterAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<CoinsTransaction> CoinsTransactions { get; set; } = new List<CoinsTransaction>();
    public AdminTelegramBinding? TelegramBinding { get; set; }


     public static User Create(string identityUserId, string email, string? fullName = null)
    {
        if (string.IsNullOrWhiteSpace(identityUserId))
            throw new ArgumentException("Identity user ID is required.", nameof(identityUserId));

        var now = DateTime.UtcNow;

        return new User
        {
            AppUserId = identityUserId,
            Email = email,
            FullName = NormalizeNullable(fullName)!,
            RegisterAt = now,
            UpdatedAt = now
        };
    }

    public void UpdateProfile(string? fullName, string? bio)
    {
        FullName = NormalizeNullable(fullName)!;
        Bio = NormalizeNullable(bio);
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateAvatar(string? avatarUrl)
    {
        AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl)
            ? null
            : avatarUrl.Trim();

        UpdatedAt = DateTime.UtcNow;
    }


    public void ClearAvatar()
    {
        AvatarUrl = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetRegisterAtIfDefault(DateTime registerAt)
    {
        if (RegisterAt == default)
        {
            RegisterAt = registerAt;
            UpdatedAt = DateTime.UtcNow;
        }
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}