namespace Application.DTOs.Profile;

public class ProfileDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public int CoinsBalance { get; set; }
    public string? PhoneNumber { get; set; }
    public Guid? DeliveryCityId { get; set; }
    public string? DeliveryAddress { get; set; }

}
