using Domain.Enums;

namespace Application.DTOs.RolePermission;

public class GetRolePermissionDto
{
    public Guid Id { get; set; }
    public UserRole Role { get; set; }
    public string PermissionKey { get; set; } = default!;
    public bool IsGranted { get; set; }
}
