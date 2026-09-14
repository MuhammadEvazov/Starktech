using Application.Result;

namespace Application.DTOs.AdminTelegramBinding;

public class GetAdminTelegramBindingFilterDto : PageRequest
{
    public Guid? UserId { get; set; }
    public bool? IsActive { get; set; }
}
