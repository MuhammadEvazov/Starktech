using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IFileService
{
    string? ValidateImage(IFormFile? file);
    Task<string?> UploadAsync(IFormFile file, string folderName);
    Task<bool> DeleteAsync(string filePath);
}
