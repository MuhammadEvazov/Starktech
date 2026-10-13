using System.ComponentModel.DataAnnotations;
using Domain.Enums;

namespace Application.DTOs.Layout;

public class LayoutDto
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string ImageUrl { get; set; } = default!;
    public string? Note { get; set; }
    public LayoutStatus Status { get; set; }
    public string? CustomerComment { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public string UploadedBy { get; set; } = default!;
}

public class RequestLayoutChangesDto
{
    [MaxLength(500)]
    public string? Comment { get; set; }
}
