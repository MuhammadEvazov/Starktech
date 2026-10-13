using System.ComponentModel.DataAnnotations;
using Application.Validation;

namespace Application.DTOs.Profile;

public class UpdateProfileDto
{
    [MaxLength(100)]
    [PersonName]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Bio { get; set; }

    [MaxLength(1000)]
    public string? AvatarUrl { get; set; }

    // Для оформления заказа: подставляются автоматически, если заполнены.
    [MaxLength(30)]
    [PhoneNumberFormat]
    public string? PhoneNumber { get; set; }

    /// <summary>null — самовывоз.</summary>
    public Guid? DeliveryCityId { get; set; }

    [MaxLength(300)]
    public string? DeliveryAddress { get; set; }
}
