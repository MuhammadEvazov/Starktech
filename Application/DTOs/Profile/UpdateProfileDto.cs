using System.ComponentModel.DataAnnotations;

namespace Application.DTOs.Profile;

public class UpdateProfileDto
{    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Bio { get; set; }

    [MaxLength(1000)]
    public string? AvatarUrl { get; set; }
}
