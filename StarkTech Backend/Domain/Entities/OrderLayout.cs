using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Макет, который менеджер отправил клиенту на согласование перед производством.
/// </summary>
public class OrderLayout : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = default!;

    public string ImageUrl { get; set; } = default!;
    public string? Note { get; set; }

    public LayoutStatus Status { get; set; } = LayoutStatus.Pending;
    public string? CustomerComment { get; set; }
    public DateTime? RespondedAt { get; set; }

    // Имя сотрудника, загрузившего макет.
    public string UploadedBy { get; set; } = default!;
}
