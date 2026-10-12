using Microsoft.AspNetCore.Http;

namespace Application.Interfaces.Services;

public interface IFileService
{
    string? ValidateImage(IFormFile? file);
    Task<string?> UploadAsync(IFormFile file, string folderName);

    /// <summary>Фото (JPG/PNG/WEBP) или видео (MP4/MOV/WEBM) для галереи товара.</summary>
    string? ValidateMedia(IFormFile? file, out bool isVideo);
    Task<string?> UploadMediaAsync(IFormFile file, string folderName);
    Task<bool> DeleteAsync(string filePath);
}
