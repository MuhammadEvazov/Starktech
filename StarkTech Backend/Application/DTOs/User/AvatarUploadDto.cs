using Microsoft.AspNetCore.Http;

namespace Application.DTOs.User;

public class AvatarUploadDto
{
    public IFormFile File { get; set; } = null!;
}
