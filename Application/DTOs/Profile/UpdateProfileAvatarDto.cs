using Microsoft.AspNetCore.Http;

namespace Application.DTOs.Profile;

public class UpdateProfileAvatarDto
{
    public IFormFile? File { get; set; }
}
