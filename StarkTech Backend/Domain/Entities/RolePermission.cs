using Domain.Enums;

namespace Domain.Entities;

public class RolePermission : BaseEntity
{
    public UserRole Role { get; set; }
    public string PermissionKey { get; set; } = default!; // напр. "orders.edit"
    public bool IsGranted { get; set; }
}
